/**
 * Appointment data contract — pure, client-safe types + row mapper shared by the
 * booking and admin server actions AND their UI. Kept out of core.ts (which
 * touches the DB) so it can flow through the module's public barrel without
 * pulling the database client into client bundles.
 */

/** Generic discriminated result for server actions that can fail. */
export type ActionResult<E extends string = string> =
  | { ok: true }
  | { ok: false; error: E };

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
