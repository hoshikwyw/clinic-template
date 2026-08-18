"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { and, eq, desc, isNull, sql } from "drizzle-orm";
import { db } from "@db/index";
import { appointments, patients } from "@db/schema";
import { getClinicConfig } from "@/config/clinic";
import { getSessionUser } from "@auth";
import { checkRateLimits } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { normalizePhone } from "@/lib/phone";
import { buildZodSchema } from "@form-engine/schema";
import type { DaySlots } from "@modules/scheduling";
import {
  notifyAppointmentBooked,
  notifyAppointmentStatus,
} from "@modules/notifications";
import {
  computeAvailableSlots,
  isUniqueViolation,
  moveAppointment,
  occupiesSlot,
} from "./core";
import { toAppointmentDTO, type AppointmentDTO } from "../dto";

/**
 * Booking server actions. Run on a trusted direct DB connection (Drizzle), so
 * they bypass RLS and enforce authorization in code. Guest booking is allowed:
 * a patient row is created with no auth user.
 */

/** Available slots for a service, with already-booked slots removed. */
export async function getAvailableSlots(serviceId: string): Promise<DaySlots[]> {
  return computeAvailableSlots(serviceId);
}

const createAppointmentInput = z.object({
  serviceId: z.string().min(1),
  startIso: z.string().min(1),
  contact: z.object({
    fullName: z.string().min(1),
    phone: z.string().min(1),
    // Optional, but must be a real address when present ("" = omitted).
    email: z.union([z.email(), z.literal("")]).optional(),
  }),
  intake: z.record(z.string(), z.unknown()).optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentInput>;

/**
 * Machine-readable failure reasons. The `error` string stays for backwards
 * compatibility, but the UI should key off `code` — everything else in this app
 * is translated, and a Burmese patient should not be shown an English sentence
 * at the last step of a booking.
 */
export type BookingErrorCode =
  | "invalid"
  | "unknownService"
  | "invalidIntake"
  | "invalidTime"
  | "slotTaken"
  | "rateLimited"
  | "dailyLimit";

export interface BookingResult {
  ok: boolean;
  appointmentId?: string;
  serviceName?: string;
  startIso?: string;
  code?: BookingErrorCode;
  /** English fallback copy; prefer `code` for anything user-facing. */
  error?: string;
  /** set when code === "rateLimited" — how long until they may retry */
  retryAfterSeconds?: number;
}

/** English fallback copy, one per failure code. */
const BOOKING_ERROR_TEXT: Record<BookingErrorCode, string> = {
  invalid: "Invalid booking details.",
  unknownService: "Unknown service.",
  invalidIntake: "Please check the intake form details.",
  invalidTime: "Invalid time.",
  slotTaken: "Sorry, that slot was just taken. Pick another.",
  rateLimited: "Too many booking attempts. Please try again shortly.",
  dailyLimit: "You already have an appointment booked for that day.",
};

function bookingError(
  code: BookingErrorCode,
  extra?: { retryAfterSeconds?: number }
): BookingResult {
  return { ok: false, code, error: BOOKING_ERROR_TEXT[code], ...extra };
}

/**
 * Abuse limits for the public (unauthenticated) booking endpoint.
 *
 * Sizing: a real patient books once, occasionally twice, and retries a couple
 * of times when a slot is taken. A household or a clinic's own front desk may
 * share one IP, hence the generous per-IP allowance; the per-phone limit is the
 * tight one, because a slot-exhaustion script has to supply *some* number.
 */
const BOOKING_LIMITS = {
  ipBurst: { limit: 8, windowSeconds: 600 },
  ipDaily: { limit: 40, windowSeconds: 86_400 },
  phoneDaily: { limit: 6, windowSeconds: 86_400 },
} as const;

/** Create a (guest) patient + appointment for a chosen slot. */
export async function createAppointment(
  raw: CreateAppointmentInput
): Promise<BookingResult> {
  const parsed = createAppointmentInput.safeParse(raw);
  if (!parsed.success) return bookingError("invalid");
  const input = parsed.data;

  const config = getClinicConfig();
  const service = config.services.find((s) => s.id === input.serviceId);
  if (!service) return bookingError("unknownService");

  // Canonical phone: used to match a returning guest to their existing record
  // and as the rate-limit bucket, so reformatting the number doesn't reset it.
  const phoneKey = normalizePhone(
    input.contact.phone,
    config.locale.phoneCountryCode
  );

  // Abuse guard. This endpoint is unauthenticated AND a booking locks a start
  // time for the whole clinic, so an unthrottled caller can exhaust the entire
  // booking horizon. Checked before any write, but after parsing, so the
  // counters key off a real phone number rather than arbitrary input.
  const ip = await getClientIp();
  const limited = await checkRateLimits([
    { scope: "booking:ip:burst", identifier: ip, ...BOOKING_LIMITS.ipBurst },
    { scope: "booking:ip:daily", identifier: ip, ...BOOKING_LIMITS.ipDaily },
    ...(phoneKey
      ? [
          {
            scope: "booking:phone:daily",
            identifier: phoneKey,
            ...BOOKING_LIMITS.phoneDaily,
          },
        ]
      : []),
  ]);
  if (!limited.ok) {
    return bookingError("rateLimited", {
      retryAfterSeconds: limited.retryAfterSeconds,
    });
  }

  // Validate intake server-side against THIS clinic's form definition. The
  // client validates too, but never trust it — this rejects crafted payloads
  // and strips unknown keys before the JSON is stored. If the clinic defines no
  // intake form, any submitted intake is ignored.
  let intakeValue: Record<string, unknown> | null = null;
  if (config.intakeForm.length > 0) {
    const parsedIntake = buildZodSchema(config.intakeForm).safeParse(
      input.intake ?? {}
    );
    if (!parsedIntake.success) return bookingError("invalidIntake");
    intakeValue = parsedIntake.data as Record<string, unknown>;
  }

  // Capture the patient's language (validated against the clinic's) so their
  // notification emails go out in the right language.
  const cookieLocale = await getLocale();
  const patientLocale = config.locale.languages.includes(cookieLocale)
    ? cookieLocale
    : config.locale.defaultLang;

  const startAt = new Date(input.startIso);
  if (Number.isNaN(startAt.getTime())) return bookingError("invalidTime");
  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);

  // Guard against the slot being taken between listing and confirming.
  const clash = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.startAt, startAt), occupiesSlot()))
    .limit(1);
  if (clash.length > 0) return bookingError("slotTaken");

  // Logged-in patient → reuse/refresh their record; guest → create a new one.
  const user = await getSessionUser();
  let patientId: string;

  if (user) {
    const [existing] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.authUserId, user.id))
      .limit(1);
    if (existing) {
      patientId = existing.id;
      await db
        .update(patients)
        .set({
          fullName: input.contact.fullName,
          phone: input.contact.phone,
          phoneNormalized: phoneKey || null,
          email: input.contact.email || null,
          intake: intakeValue,
          locale: patientLocale,
          updatedAt: new Date(),
        })
        .where(eq(patients.id, existing.id));
    } else {
      const [created] = await db
        .insert(patients)
        .values({
          authUserId: user.id,
          fullName: input.contact.fullName,
          phone: input.contact.phone,
          phoneNormalized: phoneKey || null,
          email: input.contact.email || null,
          intake: intakeValue,
          locale: patientLocale,
        })
        .returning({ id: patients.id });
      patientId = created.id;
    }
  } else {
    // Returning guest → reuse their record. Without this, every booking made
    // without an account creates another patient row, and the staff directory
    // fills up with duplicates of the same person under slightly different
    // phone formatting. Matched on the normalised number, and only against
    // other guests: a guest booking must never attach itself to a registered
    // patient's record just because the numbers agree.
    const [existingGuest] = phoneKey
      ? await db
          .select({ id: patients.id })
          .from(patients)
          .where(
            and(
              isNull(patients.authUserId),
              eq(patients.phoneNormalized, phoneKey)
            )
          )
          .orderBy(desc(patients.createdAt))
          .limit(1)
      : [];

    if (existingGuest) {
      patientId = existingGuest.id;
      await db
        .update(patients)
        .set({
          fullName: input.contact.fullName,
          phone: input.contact.phone,
          phoneNormalized: phoneKey || null,
          email: input.contact.email || null,
          intake: intakeValue,
          locale: patientLocale,
          updatedAt: new Date(),
        })
        .where(eq(patients.id, existingGuest.id));
    } else {
      const [guest] = await db
        .insert(patients)
        .values({
          fullName: input.contact.fullName,
          phone: input.contact.phone,
          phoneNormalized: phoneKey || null,
          email: input.contact.email || null,
          intake: intakeValue,
          locale: patientLocale,
        })
        .returning({ id: patients.id });
      patientId = guest.id;
    }
  }

  // Enforce the clinic's per-patient daily cap. This rule has been declared in
  // ClinicConfig.bookingRules since the config engine shipped (and is set to 1
  // in the pediatric sample) but was never actually applied — a config that
  // lies is worse than no config. Counted in the clinic's own timezone, over
  // appointments that still hold a slot.
  const maxPerDay = config.bookingRules.maxPerDayPerPatient;
  if (maxPerDay !== undefined) {
    const tz = config.locale.timezone;
    const [row] = await db
      .select({ used: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, patientId),
          occupiesSlot(),
          sql`(${appointments.startAt} AT TIME ZONE ${tz})::date
              = (${startAt.toISOString()}::timestamptz AT TIME ZONE ${tz})::date`
        )
      );
    if (Number(row?.used ?? 0) >= maxPerDay) return bookingError("dailyLimit");
  }

  let appointmentId: string;
  let confirmedStartIso: string;
  try {
    const [appt] = await db
      .insert(appointments)
      .values({
        patientId,
        serviceId: service.id,
        serviceName: service.name,
        startAt,
        endAt,
        status: "pending",
      })
      .returning({ id: appointments.id, startAt: appointments.startAt });
    appointmentId = appt.id;
    confirmedStartIso = appt.startAt.toISOString();
  } catch (err) {
    // The partial unique index (appointments_active_slot_unique) makes this the
    // authoritative, race-free clash check — the earlier select is just a fast
    // path for the common case.
    if (isUniqueViolation(err)) {
      return { ok: false, error: "Sorry, that slot was just taken. Pick another." };
    }
    throw err;
  }

  await notifyAppointmentBooked({
    to: input.contact.email || null,
    patientName: input.contact.fullName,
    serviceName: service.name,
    startIso: confirmedStartIso,
    locale: patientLocale,
  });

  return {
    ok: true,
    appointmentId,
    serviceName: service.name,
    startIso: confirmedStartIso,
  };
}

export type MyAppointment = AppointmentDTO;

/** Appointments for the currently logged-in patient (newest first). */
export async function getMyAppointments(): Promise<MyAppointment[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const rows = await db
    .select({
      id: appointments.id,
      serviceId: appointments.serviceId,
      serviceName: appointments.serviceName,
      startAt: appointments.startAt,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(eq(patients.authUserId, user.id))
    .orderBy(desc(appointments.startAt));

  return rows.map(toAppointmentDTO);
}

export interface CancelResult {
  ok: boolean;
  error?: "unauthorized" | "notFound" | "window" | "alreadyEnded";
}

/**
 * Cancel one of the logged-in patient's own appointments. Enforces ownership
 * and the clinic's cancellation window (config.bookingRules.cancellationWindowHours).
 */
export async function cancelMyAppointment(
  appointmentId: string
): Promise<CancelResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  // Ownership check: the appointment must belong to this user's patient record.
  const [row] = await db
    .select({
      id: appointments.id,
      startAt: appointments.startAt,
      status: appointments.status,
      serviceName: appointments.serviceName,
      patientName: patients.fullName,
      email: patients.email,
      locale: patients.locale,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(
      and(eq(appointments.id, appointmentId), eq(patients.authUserId, user.id))
    )
    .limit(1);

  if (!row) return { ok: false, error: "notFound" };
  if (row.status === "cancelled" || row.status === "completed") {
    return { ok: false, error: "alreadyEnded" };
  }

  // Enforce the cancellation window: must cancel at least N hours before start.
  const windowMs =
    getClinicConfig().bookingRules.cancellationWindowHours * 3_600_000;
  if (row.startAt.getTime() - Date.now() < windowMs) {
    return { ok: false, error: "window" };
  }

  await db
    .update(appointments)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId));

  await notifyAppointmentStatus({
    to: row.email,
    patientName: row.patientName,
    serviceName: row.serviceName,
    startIso: row.startAt.toISOString(),
    status: "cancelled",
    locale: row.locale,
  });

  return { ok: true };
}

const rescheduleInput = z.object({
  appointmentId: z.string().min(1),
  startIso: z.string().min(1),
});

export interface RescheduleResult {
  ok: boolean;
  error?: "unauthorized" | "notFound" | "window" | "unavailable" | "invalid";
}

/**
 * Move one of the logged-in patient's appointments to a new slot. Enforces
 * ownership, the cancellation window (on the CURRENT time), and that the new
 * slot is genuinely available. Resets to pending + clears the reminder so the
 * new time gets re-confirmed and re-reminded.
 */
export async function rescheduleMyAppointment(
  raw: unknown
): Promise<RescheduleResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const parsed = rescheduleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { appointmentId, startIso } = parsed.data;

  const [row] = await db
    .select({
      id: appointments.id,
      serviceId: appointments.serviceId,
      startAt: appointments.startAt,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(
      and(eq(appointments.id, appointmentId), eq(patients.authUserId, user.id))
    )
    .limit(1);

  if (!row) return { ok: false, error: "notFound" };
  if (row.status === "cancelled" || row.status === "completed") {
    return { ok: false, error: "notFound" };
  }

  const windowMs =
    getClinicConfig().bookingRules.cancellationWindowHours * 3_600_000;
  if (row.startAt.getTime() - Date.now() < windowMs) {
    return { ok: false, error: "window" };
  }

  // Ownership + window verified; delegate slot validation + the write.
  return moveAppointment(appointmentId, row.serviceId, startIso);
}
