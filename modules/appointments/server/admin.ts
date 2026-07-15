"use server";

import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@db/index";
import { appointments, patients } from "@db/schema";
import { requireStaff } from "@auth";
import { getClinicConfig } from "@/config/clinic";
import { notifyAppointmentStatus } from "@modules/notifications";
import {
  moveAppointment,
  toAppointmentDTO,
  type ActionResult,
  type AppointmentDTO,
} from "./core";

/**
 * Staff-only appointment management. Every action calls requireStaff(), which
 * throws unless the caller has a non-patient role (role comes from the secure
 * app_metadata). See packages/auth.
 */

export interface AdminAppointment extends AppointmentDTO {
  patientId: string;
  patientName: string;
  patientPhone: string;
}

/** Default page size for the admin appointments list. */
export const APPOINTMENTS_PAGE_SIZE = 20;

// Shared select shape + row mapper for the admin appointment lists.
const adminAppointmentColumns = {
  id: appointments.id,
  patientId: patients.id,
  patientName: patients.fullName,
  patientPhone: patients.phone,
  serviceId: appointments.serviceId,
  serviceName: appointments.serviceName,
  startAt: appointments.startAt,
  status: appointments.status,
};

function toAdminAppointment(r: {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  serviceId: string;
  serviceName: string;
  startAt: Date;
  status: string;
}): AdminAppointment {
  return {
    ...toAppointmentDTO(r),
    patientId: r.patientId,
    patientName: r.patientName,
    patientPhone: r.patientPhone,
  };
}

/**
 * All appointments with patient contact info (newest first). Unbounded — use
 * for bulk operations only (e.g. CSV export); the dashboard uses the paginated
 * getAppointmentsPage.
 */
export async function getAllAppointments(): Promise<AdminAppointment[]> {
  await requireStaff();

  const rows = await db
    .select(adminAppointmentColumns)
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .orderBy(desc(appointments.startAt));

  return rows.map(toAdminAppointment);
}

/** One page of appointments with patient contact info (newest first). */
export async function getAppointmentsPage(
  opts: { limit?: number; offset?: number } = {}
): Promise<AdminAppointment[]> {
  await requireStaff();

  const rows = await db
    .select(adminAppointmentColumns)
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .orderBy(desc(appointments.startAt))
    .limit(opts.limit ?? APPOINTMENTS_PAGE_SIZE)
    .offset(opts.offset ?? 0);

  return rows.map(toAdminAppointment);
}

export interface DashboardStats {
  today: number;
  pending: number;
  upcoming: number;
  total: number;
}

/**
 * Dashboard stat counts, computed in SQL (one round-trip) instead of loading
 * every appointment into the page. "Today" is the clinic-timezone calendar day
 * and excludes cancelled; "upcoming" excludes cancelled.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  await requireStaff();
  const tz = getClinicConfig().locale.timezone;

  const [row] = await db
    .select({
      today: sql<number>`(count(*) filter (where ${appointments.status} <> 'cancelled' and (${appointments.startAt} AT TIME ZONE ${tz})::date = (now() AT TIME ZONE ${tz})::date))::int`,
      pending: sql<number>`(count(*) filter (where ${appointments.status} = 'pending'))::int`,
      upcoming: sql<number>`(count(*) filter (where ${appointments.status} <> 'cancelled' and ${appointments.startAt} >= now()))::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(appointments);

  return {
    today: Number(row?.today ?? 0),
    pending: Number(row?.pending ?? 0),
    upcoming: Number(row?.upcoming ?? 0),
    total: Number(row?.total ?? 0),
  };
}

const statusSchema = z.enum([
  "pending",
  "confirmed",
  "cancelled",
  "completed",
]);

/** Update an appointment's status (confirm / cancel / complete). */
export async function updateAppointmentStatus(
  id: string,
  status: string
): Promise<void> {
  await requireStaff();
  const parsed = statusSchema.parse(status);

  await db
    .update(appointments)
    .set({ status: parsed, updatedAt: new Date() })
    .where(eq(appointments.id, id));

  // Notify the patient on meaningful transitions.
  if (parsed === "confirmed" || parsed === "cancelled") {
    const [row] = await db
      .select({
        email: patients.email,
        name: patients.fullName,
        locale: patients.locale,
        serviceName: appointments.serviceName,
        startAt: appointments.startAt,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .where(eq(appointments.id, id))
      .limit(1);
    if (row) {
      await notifyAppointmentStatus({
        to: row.email,
        patientName: row.name,
        serviceName: row.serviceName,
        startIso: row.startAt.toISOString(),
        status: parsed,
        locale: row.locale,
      });
    }
  }

  revalidatePath("/admin");
}

export type AdminRescheduleResult = ActionResult<
  "notFound" | "unavailable" | "invalid"
>;

/**
 * Staff reschedule an appointment to a new slot (e.g. for a phone booking).
 * Staff may move any appointment, so there's no ownership/window check —
 * delegate slot validation + the write to the shared helper.
 */
export async function rescheduleAppointment(
  appointmentId: string,
  startIso: string
): Promise<AdminRescheduleResult> {
  await requireStaff();

  const [row] = await db
    .select({ serviceId: appointments.serviceId })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);
  if (!row) return { ok: false, error: "notFound" };

  const result = await moveAppointment(appointmentId, row.serviceId, startIso);
  if (result.ok) revalidatePath("/admin");
  return result;
}
