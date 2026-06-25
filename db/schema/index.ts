/**
 * Drizzle schema barrel — every table is exported from here.
 *
 * Single-tenant per deployment: this database belongs to ONE clinic, so there
 * is no `clinics` table and no clinic_id columns. Tables here hold that clinic's
 * operational data (patients, appointments, …). RLS is role-based (patient vs
 * doctor/staff via Supabase Auth), not tenant-based.
 *
 * See docs/02-architecture.md.
 */

export * from "./patients";
export * from "./appointments";
