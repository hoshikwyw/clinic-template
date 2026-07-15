"use server";

import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@db/index";
import { patients, appointments } from "@db/schema";
import { requireStaff } from "@auth";
import {
  toAppointmentDTO,
  type AppointmentDTO,
} from "@modules/appointments/server/core";

/**
 * Staff-only patient directory. Every action calls requireStaff() (role from
 * the secure app_metadata). See packages/auth.
 */

export interface PatientListItem {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  appointmentCount: number;
}

/** List patients, optionally filtered by a name/phone search. */
export async function getPatientsList(
  search?: string
): Promise<PatientListItem[]> {
  await requireStaff();
  const q = (search ?? "").trim();
  const where = q
    ? or(ilike(patients.fullName, `%${q}%`), ilike(patients.phone, `%${q}%`))
    : undefined;

  const rows = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      phone: patients.phone,
      email: patients.email,
      count: sql<number>`count(${appointments.id})`,
    })
    .from(patients)
    .leftJoin(appointments, eq(appointments.patientId, patients.id))
    .where(where)
    .groupBy(patients.id)
    .orderBy(asc(patients.fullName));

  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    phone: r.phone,
    email: r.email,
    appointmentCount: Number(r.count),
  }));
}

export interface PatientDetail {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  dateOfBirth: string | null;
  intake: Record<string, unknown> | null;
  hasAccount: boolean;
  appointments: AppointmentDTO[];
}

/** A single patient with their full record + appointment history. */
export async function getPatientDetail(
  id: string
): Promise<PatientDetail | null> {
  await requireStaff();

  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, id))
    .limit(1);
  if (!p) return null;

  const appts = await db
    .select({
      id: appointments.id,
      serviceId: appointments.serviceId,
      serviceName: appointments.serviceName,
      startAt: appointments.startAt,
      status: appointments.status,
    })
    .from(appointments)
    .where(eq(appointments.patientId, id))
    .orderBy(desc(appointments.startAt));

  return {
    id: p.id,
    fullName: p.fullName,
    phone: p.phone,
    email: p.email,
    dateOfBirth: p.dateOfBirth,
    intake: (p.intake as Record<string, unknown> | null) ?? null,
    hasAccount: Boolean(p.authUserId),
    appointments: appts.map(toAppointmentDTO),
  };
}
