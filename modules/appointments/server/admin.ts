"use server";

import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@db/index";
import { appointments, patients } from "@db/schema";
import { requireStaff } from "@auth";
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

/** All appointments with patient contact info (newest first). */
export async function getAllAppointments(): Promise<AdminAppointment[]> {
  await requireStaff();

  const rows = await db
    .select({
      id: appointments.id,
      patientId: patients.id,
      patientName: patients.fullName,
      patientPhone: patients.phone,
      serviceId: appointments.serviceId,
      serviceName: appointments.serviceName,
      startAt: appointments.startAt,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .orderBy(desc(appointments.startAt));

  return rows.map((r) => ({
    ...toAppointmentDTO(r),
    patientId: r.patientId,
    patientName: r.patientName,
    patientPhone: r.patientPhone,
  }));
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
