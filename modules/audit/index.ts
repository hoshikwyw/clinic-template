/**
 * audit module — the record of who accessed patient data.
 *
 * docs/02-architecture.md makes this a non-negotiable, alongside "no PHI in
 * logs". Both halves matter: staff-facing actions record that they happened,
 * and the record itself never contains the data it is protecting.
 *
 * Not a "use server" module — it is called *from* server actions, never from a
 * client. This file is the module's PUBLIC API; import from "@modules/audit".
 *
 * See docs/02-architecture.md ("Security & compliance").
 */
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@db/index";
import { auditLog } from "@db/schema";
import { getSessionUser, requireAdmin } from "@auth";

/**
 * The vocabulary. A closed set rather than free-form strings, so the log stays
 * queryable and a typo can't silently create a category nobody ever reviews.
 */
export const AUDIT_ACTIONS = [
  /** a staff member opened one patient's full record, including intake answers */
  "patient.view",
  /** a staff member listed or searched the patient directory */
  "patient.list",
  /** patient contact details left the system in bulk (CSV) */
  "patient.export",
  "appointment.status",
  "appointment.reschedule",
  /** privilege change — the highest-consequence action in the app */
  "staff.role",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditSubjectType = "patient" | "appointment" | "staff";

/**
 * Context stored with an entry. Primitives only, and NON-PHI only: counts,
 * ids, status transitions, whether a search was used — never the search text, a
 * name, a number, or anything from the intake form.
 */
export type AuditMetadata = Record<string, string | number | boolean | null>;

export interface AuditEntry {
  action: AuditAction;
  subjectType: AuditSubjectType;
  /** the record acted on; omit for list/bulk actions */
  subjectId?: string | null;
  metadata?: AuditMetadata;
}

/**
 * Record an audited action, attributed to the current session user.
 *
 * NEVER THROWS. A failed audit write must not take down the clinic's dashboard
 * mid-shift, so failures are logged as errors instead of propagating.
 *
 * Be clear about what that buys and what it costs: this is an audit trail
 * strong enough to answer "who opened this patient's file", not a
 * tamper-evident ledger. The write is a separate statement from the action it
 * describes, so a crash between the two loses the entry. Making it atomic would
 * mean threading a transaction through every server action; making it fatal
 * would mean an audit outage stops patient care. If a deployment ever needs the
 * stronger guarantee, the honest fix is a database trigger, not a flag here.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const user = await getSessionUser();
    await db.insert(auditLog).values({
      actorId: user?.id ?? null,
      actorEmail: user?.email ?? null,
      actorRole: user?.role ?? null,
      action: entry.action,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch (err) {
    console.error(`[audit] failed to record "${entry.action}":`, err);
  }
}

export interface AuditEntryDTO {
  id: string;
  atIso: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  subjectType: string;
  subjectId: string | null;
  metadata: AuditMetadata | null;
}

/**
 * Read the trail. ADMIN ONLY — the log names which staff member looked at what,
 * which is exactly the kind of thing that should not be browsable by every
 * receptionist.
 *
 * @param opts.subjectId  answer "who accessed this patient's record?"
 * @param opts.sinceIso   restrict to a window
 */
export async function getAuditLog(
  opts: { subjectId?: string; sinceIso?: string; limit?: number } = {}
): Promise<AuditEntryDTO[]> {
  await requireAdmin();

  const filters = [
    opts.subjectId ? eq(auditLog.subjectId, opts.subjectId) : undefined,
    opts.sinceIso ? gte(auditLog.at, new Date(opts.sinceIso)) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select()
    .from(auditLog)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(auditLog.at))
    .limit(Math.min(opts.limit ?? 100, 500));

  return rows.map((r) => ({
    id: r.id,
    atIso: r.at.toISOString(),
    actorEmail: r.actorEmail,
    actorRole: r.actorRole,
    action: r.action,
    subjectType: r.subjectType,
    subjectId: r.subjectId,
    metadata: (r.metadata as AuditMetadata | null) ?? null,
  }));
}
