import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * audit_log — who touched patient data, and when.
 *
 * docs/02-architecture.md lists this as a non-negotiable: "audit logging for any
 * access to patient data (who saw what, when)". It is the record a clinic needs
 * when a patient asks who has read their file, and the first thing any
 * compliance conversation asks for.
 *
 * WHAT GOES IN HERE: the actor, the action, and which record. Nothing else.
 * The same document requires "no PHI in logs" — so `metadata` holds counts,
 * search-term *lengths*, status transitions and ids, never a name, a phone
 * number, an address, or anything from the intake form. An audit trail that
 * itself leaks the records it is protecting is worse than no audit trail.
 *
 * Append-only by convention: nothing in the app updates or deletes a row here.
 * RLS is enabled with NO policies, so anon/authenticated clients cannot read it
 * at all — only the trusted server connection writes it.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
    /** auth user id of the staff member; null for system actions (cron) */
    actorId: uuid("actor_id"),
    /** snapshot, so the trail survives the account being deleted */
    actorEmail: text("actor_email"),
    actorRole: text("actor_role"),
    /** dotted verb, e.g. "patient.view" — see modules/audit for the vocabulary */
    action: text("action").notNull(),
    /** "patient" | "appointment" | "staff" */
    subjectType: text("subject_type").notNull(),
    /** id of the record acted on; null for list/bulk actions */
    subjectId: text("subject_id"),
    /** non-PHI context only — counts, ids, status transitions */
    metadata: jsonb("metadata"),
  },
  (t) => [
    // "Who saw this patient's file?" and "what did this staff member do?" are
    // the two questions this table exists to answer.
    index("audit_log_subject_idx").on(t.subjectType, t.subjectId, t.at),
    index("audit_log_actor_idx").on(t.actorId, t.at),
    index("audit_log_at_idx").on(t.at),
  ]
).enableRLS();

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
