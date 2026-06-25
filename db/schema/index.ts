/**
 * Drizzle schema barrel — every table is exported from here.
 *
 * Multi-tenancy: every tenant-scoped table carries `clinic_id`, and Row-Level
 * Security policies (db/rls/) enforce isolation at the database.
 *
 * NOTE: Phase 0 — no tables yet. The `clinics` table + core tables land in
 * Phase 1 alongside the config engine. See docs/02-architecture.md.
 */

export {};
