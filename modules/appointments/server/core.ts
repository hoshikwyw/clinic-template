import { and, eq, gte, inArray } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@db/index";
import { appointments, OCCUPYING_STATUSES } from "@db/schema";
import { getClinicConfig } from "@/config/clinic";
import { getProvidersForService, findProvider } from "@config-engine";
import { generateDaySlots } from "@modules/scheduling";
import type { ActionResult, ProviderSlot, ProviderDaySlots } from "../dto";

/**
 * Shared appointment domain logic — internal DB-touching helpers used by the
 * booking (patient) and admin (staff) server actions. NOT a "use server" module
 * and NOT part of the public barrel (it imports the db client): the two entry
 * points build on it so they don't duplicate slot availability or the
 * move/reschedule flow. Pure types/mappers live in ../dto.
 */

/**
 * SQL condition for "this appointment still occupies its slot" — i.e. it is not
 * cancelled and not a no-show. Mirrors the partial unique index in
 * db/schema/appointments.ts; use it anywhere availability or per-patient caps
 * are computed so the app and the database never disagree about what is booked.
 */
export function occupiesSlot() {
  return inArray(appointments.status, [...OCCUPYING_STATUSES]);
}

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
 *
 * Availability is per provider: a time is offered when at least ONE provider
 * who performs the service is free then, and each slot carries the ids of every
 * such provider. That is what lets a clinic with three dentists sell three
 * parallel appointments at 09:00, and it lets the caller either honour a
 * patient's choice of clinician or auto-assign from the free ones.
 *
 * @param serviceId  the service being booked
 * @param providerId restrict to one provider (a patient asking for "Dr. Aung");
 *                   omit for "any available"
 */
export async function computeAvailableSlots(
  serviceId: string,
  providerId?: string
): Promise<ProviderDaySlots[]> {
  const config = getClinicConfig();
  const service = config.services.find((s) => s.id === serviceId);
  if (!service) throw new Error("Unknown service");

  let providers = getProvidersForService(config, serviceId);
  if (providerId) providers = providers.filter((p) => p.id === providerId);
  if (providers.length === 0) return [];

  const locale = await getLocale();

  // One query for every provider's bookings, not one per provider.
  const booked = await db
    .select({
      providerId: appointments.providerId,
      startAt: appointments.startAt,
    })
    .from(appointments)
    .where(and(occupiesSlot(), gte(appointments.startAt, new Date())));

  const takenByProvider = new Map<string, Set<string>>();
  for (const b of booked) {
    const key = b.startAt.toISOString();
    const set = takenByProvider.get(b.providerId);
    if (set) set.add(key);
    else takenByProvider.set(b.providerId, new Set([key]));
  }

  // date -> (startIso -> { slot, providerIds }), so overlapping providers
  // collapse into one offered time rather than duplicating it.
  const byDate = new Map<
    string,
    { label: string; slots: Map<string, ProviderSlot> }
  >();

  for (const provider of providers) {
    const taken = takenByProvider.get(provider.id);
    const days = generateDaySlots({
      businessHours: config.businessHours,
      providerHours: provider.hours,
      serviceDurationMinutes: service.durationMinutes,
      timeZone: config.locale.timezone,
      leadTimeHours: config.bookingRules.leadTimeHours,
      locale,
    });

    for (const day of days) {
      let entry = byDate.get(day.date);
      if (!entry) {
        entry = { label: day.label, slots: new Map() };
        byDate.set(day.date, entry);
      }
      for (const slot of day.slots) {
        if (taken?.has(slot.startIso)) continue;
        const existing = entry.slots.get(slot.startIso);
        if (existing) existing.providerIds.push(provider.id);
        else entry.slots.set(slot.startIso, { ...slot, providerIds: [provider.id] });
      }
    }
  }

  return [...byDate.entries()]
    .map(([date, entry]) => ({
      date,
      label: entry.label,
      slots: [...entry.slots.values()].sort((a, b) =>
        a.startIso.localeCompare(b.startIso)
      ),
    }))
    .filter((d) => d.slots.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The providers free for a service at an exact time, in config order (so the
 * first is the clinic's preferred choice). Empty when the slot isn't bookable.
 */
export async function providersFreeAt(
  serviceId: string,
  startIso: string,
  providerId?: string
): Promise<string[]> {
  const days = await computeAvailableSlots(serviceId, providerId);
  for (const day of days) {
    const slot = day.slots.find((s) => s.startIso === startIso);
    if (slot) return slot.providerIds;
  }
  return [];
}

/** Is `startIso` a currently-bookable slot for this service? */
export async function isSlotAvailable(
  serviceId: string,
  startIso: string,
  providerId?: string
): Promise<boolean> {
  return (await providersFreeAt(serviceId, startIso, providerId)).length > 0;
}

export type MoveError = "invalid" | "unavailable";

/**
 * Move an appointment to a new slot. The CALLER is responsible for auth,
 * ownership, and the cancellation window; this handles only the slot validation
 * and the write. Resets to pending + clears the reminder so the new time is
 * re-confirmed and re-reminded.
 *
 * Provider handling: the appointment keeps its current provider when that
 * provider is free at the new time — a patient rescheduling should not silently
 * be moved to a different clinician. Otherwise it is reassigned to whoever is
 * free, which is what makes rescheduling useful in a multi-provider clinic.
 *
 * @param currentProviderId the provider the appointment is currently with
 */
export async function moveAppointment(
  appointmentId: string,
  serviceId: string,
  startIso: string,
  currentProviderId?: string
): Promise<ActionResult<MoveError>> {
  const config = getClinicConfig();
  const service = config.services.find((s) => s.id === serviceId);
  if (!service) return { ok: false, error: "invalid" };

  const free = await providersFreeAt(serviceId, startIso);
  if (free.length === 0) return { ok: false, error: "unavailable" };

  // Prefer staying with the same clinician; fall back to the clinic's order.
  const ordered =
    currentProviderId && free.includes(currentProviderId)
      ? [currentProviderId, ...free.filter((id) => id !== currentProviderId)]
      : free;

  const newStart = new Date(startIso);
  const newEnd = new Date(newStart.getTime() + service.durationMinutes * 60_000);

  // The partial unique index is the authoritative clash check, so a lost race
  // surfaces as 23505 — with several providers free, try the next one rather
  // than telling the patient a slot they can see is unavailable.
  for (const candidate of ordered) {
    try {
      await db
        .update(appointments)
        .set({
          startAt: newStart,
          endAt: newEnd,
          providerId: candidate,
          providerName: findProvider(config, candidate)?.name ?? null,
          status: "pending",
          reminderSentAt: null,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, appointmentId));
      return { ok: true };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }

  return { ok: false, error: "unavailable" };
}
