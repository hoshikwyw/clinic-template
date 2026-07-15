import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  text,
  date,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * patients — people who book at THIS clinic (single-tenant, so no clinic_id).
 *
 * Guest booking is allowed: `authUserId` is null until/unless the patient
 * creates an account, at which point it links to Supabase `auth.users`.
 *
 * RLS (role-based, defense-in-depth): a logged-in patient may read/update only
 * their own row. Trusted server actions use a direct DB connection and bypass
 * RLS; authorization is enforced in app code. See db/rls/README.md.
 */
export const patients = pgTable(
  "patients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** links to auth.users when the patient has an account; null for guests */
    authUserId: uuid("auth_user_id"),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    /** preferred language (e.g. "en", "my") — captured at booking, used for emails */
    locale: text("locale"),
    dateOfBirth: date("date_of_birth"),
    /** snapshot of intake-form answers (form-engine schema is config-driven) */
    intake: jsonb("intake"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    // One patient row per auth account (guests have null auth_user_id and are
    // exempt). Keeps the RLS predicate auth.uid() = auth_user_id unambiguous.
    uniqueIndex("patients_auth_user_id_unique")
      .on(t.authUserId)
      .where(sql`auth_user_id is not null`),
    pgPolicy("patients_self_select", {
      for: "select",
      to: "authenticated",
      using: sql`auth.uid() = ${t.authUserId}`,
    }),
    pgPolicy("patients_self_update", {
      for: "update",
      to: "authenticated",
      using: sql`auth.uid() = ${t.authUserId}`,
    }),
  ]
).enableRLS();

export type PatientRow = typeof patients.$inferSelect;
export type NewPatientRow = typeof patients.$inferInsert;
