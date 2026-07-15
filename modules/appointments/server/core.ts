import { and, eq, gte, ne } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@db/index";
import { appointments } from "@db/schema";
import { getClinicConfig } from "@/config/clinic";
import { generateDaySlots, type DaySlots } from "@modules/scheduling";

/**
 * Shared appointment domain logic — internal helpers used by the booking (patient)
 * and admin (staff) server actions. NOT a "use server" module: it holds plain
 * functions and types the actions build on, so the two entry points don't
 * duplicate slot availability, the row→DTO mapping, or the move/reschedule flow.
 */

/** Default page size for the admin appointments list. */
export const APPOINTMENTS_PAGE_SIZE = 20;

/** Generic discriminated result for server actions that can fail. */
export type ActionResult<E extends string = string> =
  | { ok: true }
  | { ok: false; error: E };

/** Postgres unique-violation (e.g. two writes racing for the same slot). */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "23505"
  );
}

/** Canonical appointment shape returned to the UI (dates as ISO strings). */
export interface AppointmentDTO {
  id: string;
  serviceId: string;
  serviceName: string;
  startIso: string;
  status: string;
}

/** Map a selected appointment row to the canonical DTO. */
export function toAppointmentDTO(row: {
  id: string;
  serviceId: string;
  serviceName: string;
  startAt: Date;
  status: string;
}): AppointmentDTO {
  return {
    id: row.id,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    startIso: row.startAt.toISOString(),
    status: row.status,
  };
}

/**
 * Available slots for a service, with already-booked slots removed.
 * Single-provider MVP: one booking per start time across all services.
 */
export async function computeAvailableSlots(
  serviceId: string
): Promise<DaySlots[]> {
  const config = getClinicConfig();
  const service = config.services.find((s) => s.id === serviceId);
  if (!service) throw new Error("Unknown service");

  const days = generateDaySlots({
    businessHours: config.businessHours,
    serviceDurationMinutes: service.durationMinutes,
    timeZone: config.locale.timezone,
    leadTimeHours: config.bookingRules.leadTimeHours,
    locale: await getLocale(),
  });

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

/** Is `startIso` a currently-bookable slot for this service? */
export async function isSlotAvailable(
  serviceId: string,
  startIso: string
): Promise<boolean> {
  const days = await computeAvailableSlots(serviceId);
  return days.some((d) => d.slots.some((s) => s.startIso === startIso));
}

export type MoveError = "invalid" | "unavailable";

/**
 * Move an appointment to a new slot. The CALLER is responsible for auth,
 * ownership, and the cancellation window; this handles only the slot validation
 * and the write. Resets to pending + clears the reminder so the new time is
 * re-confirmed and re-reminded. The partial unique index makes the write the
 * authoritative race-free clash check.
 */
export async function moveAppointment(
  appointmentId: string,
  serviceId: string,
  startIso: string
): Promise<ActionResult<MoveError>> {
  const service = getClinicConfig().services.find((s) => s.id === serviceId);
  if (!service) return { ok: false, error: "invalid" };

  if (!(await isSlotAvailable(serviceId, startIso))) {
    return { ok: false, error: "unavailable" };
  }

  const newStart = new Date(startIso);
  const newEnd = new Date(newStart.getTime() + service.durationMinutes * 60_000);

  try {
    await db
      .update(appointments)
      .set({
        startAt: newStart,
        endAt: newEnd,
        status: "pending",
        reminderSentAt: null,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "unavailable" };
    throw err;
  }

  return { ok: true };
}
