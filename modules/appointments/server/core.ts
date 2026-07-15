import { and, eq, gte, ne } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@db/index";
import { appointments } from "@db/schema";
import { getClinicConfig } from "@/config/clinic";
import { generateDaySlots, type DaySlots } from "@modules/scheduling";
import type { ActionResult } from "../dto";

/**
 * Shared appointment domain logic — internal DB-touching helpers used by the
 * booking (patient) and admin (staff) server actions. NOT a "use server" module
 * and NOT part of the public barrel (it imports the db client): the two entry
 * points build on it so they don't duplicate slot availability or the
 * move/reschedule flow. Pure types/mappers live in ../dto.
 */

/** Postgres unique-violation (e.g. two writes racing for the same slot). */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "23505"
  );
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
