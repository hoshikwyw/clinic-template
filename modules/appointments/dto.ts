/**
 * Appointment data contract — pure, client-safe types + row mapper shared by the
 * booking and admin server actions AND their UI. Kept out of core.ts (which
 * touches the DB) so it can flow through the module's public barrel without
 * pulling the database client into client bundles.
 */

import type { Slot } from "@modules/scheduling";

/** Generic discriminated result for server actions that can fail. */
export type ActionResult<E extends string = string> =
  | { ok: true }
  | { ok: false; error: E };

/**
 * A bookable time plus everyone who could take it. Several providers offering
 * the same time collapse into one entry, so the patient sees "09:00" once
 * rather than once per clinician — but the caller still knows who is free, to
 * honour a requested provider or auto-assign.
 */
export interface ProviderSlot extends Slot {
  /** provider ids free at this time, in the clinic's preference order */
  providerIds: string[];
}

/** One day's provider-aware availability. */
export interface ProviderDaySlots {
  date: string;
  label: string;
  slots: ProviderSlot[];
}

/** Canonical appointment shape returned to the UI (dates as ISO strings). */
export interface AppointmentDTO {
  id: string;
  serviceId: string;
  serviceName: string;
  startIso: string;
  status: string;
  providerId: string;
  /**
   * Name as it was at booking time. Null for appointments made before providers
   * existed; render the clinic name in that case rather than "unknown".
   */
  providerName: string | null;
}

/** Map a selected appointment row to the canonical DTO. */
export function toAppointmentDTO(row: {
  id: string;
  serviceId: string;
  serviceName: string;
  startAt: Date;
  status: string;
  providerId: string;
  providerName: string | null;
}): AppointmentDTO {
  return {
    id: row.id,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    startIso: row.startAt.toISOString(),
    status: row.status,
    providerId: row.providerId,
    providerName: row.providerName,
  };
}
