"use server";

import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@db/index";
import { patients, appointments } from "@db/schema";
import { requireStaff } from "@auth";
import { toAppointmentDTO, type AppointmentDTO } from "@modules/appointments";
import { PATIENTS_PAGE_SIZE } from "../pagination";

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

export interface PatientsPage {
  items: PatientListItem[];
  /** total patients matching the search (across all pages) */
  total: number;
}

/**
 * List patients (paginated), optionally filtered by a name/phone search.
 *
 * NOTE: the search uses a leading-wildcard ILIKE, which can't use a btree index
 * and scans the table. Fine at template scale; for large directories add a
 * pg_trgm GIN index on full_name/phone (extension + migration) and switch to a
 * trigram match.
 */
export async function getPatientsList(opts: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<PatientsPage> {
  await requireStaff();
  const q = (opts.search ?? "").trim();
  const limit = opts.limit ?? PATIENTS_PAGE_SIZE;
  const offset = opts.offset ?? 0;
  const where = q
    ? or(ilike(patients.fullName, `%${q}%`), ilike(patients.phone, `%${q}%`))
    : undefined;

  const rows = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      phone: patients.phone,
      email: patients.email,
      count: sql<number>`count(${appointments.id})::int`,
      // Window count over the grouped result = total matching patients,
      // evaluated before LIMIT — one query gives both the page and the total.
      total: sql<number>`(count(*) over())::int`,
    })
    .from(patients)
    .leftJoin(appointments, eq(appointments.patientId, patients.id))
    .where(where)
    .groupBy(patients.id)
    .orderBy(asc(patients.fullName))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      phone: r.phone,
      email: r.email,
      appointmentCount: Number(r.count),
    })),
    total: rows[0] ? Number(rows[0].total) : 0,
  };
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
