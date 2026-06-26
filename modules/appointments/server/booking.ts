"use server";

import { z } from "zod";
import { and, eq, ne, gte, desc } from "drizzle-orm";
import { db } from "@db/index";
import { appointments, patients } from "@db/schema";
import { getClinicConfig } from "@/config/clinic";
import { getSessionUser } from "@auth";
import { generateDaySlots, type DaySlots } from "@modules/scheduling";
import {
  notifyAppointmentBooked,
  notifyAppointmentStatus,
} from "@modules/notifications";

/**
 * Booking server actions. Run on a trusted direct DB connection (Drizzle), so
 * they bypass RLS and enforce authorization in code. Guest booking is allowed:
 * a patient row is created with no auth user.
 */

/** Available slots for a service, with already-booked slots removed. */
export async function getAvailableSlots(serviceId: string): Promise<DaySlots[]> {
  const config = getClinicConfig();
  const service = config.services.find((s) => s.id === serviceId);
  if (!service) throw new Error("Unknown service");

  const days = generateDaySlots({
    businessHours: config.businessHours,
    serviceDurationMinutes: service.durationMinutes,
    timeZone: config.locale.timezone,
    leadTimeHours: config.bookingRules.leadTimeHours,
  });

  // Remove slots already taken (single-provider MVP: one booking per start time).
  const booked = await db
    .select({ startAt: appointments.startAt })
    .from(appointments)
    .where(
      and(
        ne(appointments.status, "cancelled"),
        gte(appointments.startAt, new Date())
      )
    );
  const taken = new Set(booked.map((b) => b.startAt.toISOString()));

  return days
    .map((d) => ({ ...d, slots: d.slots.filter((s) => !taken.has(s.startIso)) }))
    .filter((d) => d.slots.length > 0);
}

const createAppointmentInput = z.object({
  serviceId: z.string().min(1),
  startIso: z.string().min(1),
  contact: z.object({
    fullName: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().optional(),
  }),
  intake: z.record(z.string(), z.unknown()).optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentInput>;

export interface BookingResult {
  ok: boolean;
  appointmentId?: string;
  serviceName?: string;
  startIso?: string;
  error?: string;
}

/** Create a (guest) patient + appointment for a chosen slot. */
export async function createAppointment(
  raw: CreateAppointmentInput
): Promise<BookingResult> {
  const parsed = createAppointmentInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid booking details." };
  }
  const input = parsed.data;

  const config = getClinicConfig();
  const service = config.services.find((s) => s.id === input.serviceId);
  if (!service) return { ok: false, error: "Unknown service." };

  const startAt = new Date(input.startIso);
  if (Number.isNaN(startAt.getTime())) {
    return { ok: false, error: "Invalid time." };
  }
  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);

  // Guard against the slot being taken between listing and confirming.
  const clash = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.startAt, startAt),
        ne(appointments.status, "cancelled")
      )
    )
    .limit(1);
  if (clash.length > 0) {
    return { ok: false, error: "Sorry, that slot was just taken. Pick another." };
  }

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
          email: input.contact.email || null,
          intake: input.intake ?? null,
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
          email: input.contact.email || null,
          intake: input.intake ?? null,
        })
        .returning({ id: patients.id });
      patientId = created.id;
    }
  } else {
    const [guest] = await db
      .insert(patients)
      .values({
        fullName: input.contact.fullName,
        phone: input.contact.phone,
        email: input.contact.email || null,
        intake: input.intake ?? null,
      })
      .returning({ id: patients.id });
    patientId = guest.id;
  }

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

  await notifyAppointmentBooked({
    to: input.contact.email || null,
    patientName: input.contact.fullName,
    serviceName: service.name,
    startIso: appt.startAt.toISOString(),
  });

  return {
    ok: true,
    appointmentId: appt.id,
    serviceName: service.name,
    startIso: appt.startAt.toISOString(),
  };
}

export interface MyAppointment {
  id: string;
  serviceName: string;
  startIso: string;
  status: string;
}

/** Appointments for the currently logged-in patient (newest first). */
export async function getMyAppointments(): Promise<MyAppointment[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const rows = await db
    .select({
      id: appointments.id,
      serviceName: appointments.serviceName,
      startAt: appointments.startAt,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(eq(patients.authUserId, user.id))
    .orderBy(desc(appointments.startAt));

  return rows.map((r) => ({
    id: r.id,
    serviceName: r.serviceName,
    startIso: r.startAt.toISOString(),
    status: r.status,
  }));
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
  });

  return { ok: true };
}
