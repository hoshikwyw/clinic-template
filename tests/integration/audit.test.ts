import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { AUDIT_ACTIONS } from "@modules/audit";
import {
  createTestDb,
  isDatabaseAvailable,
  TEST_DATABASE_URL,
  type TestDb,
} from "../helpers/test-db";

/**
 * Audit log storage guarantees.
 *
 * Two properties matter and they pull against each other: the trail has to be
 * complete enough to answer "who opened this patient's file", and it must not
 * itself contain the data it protects. docs/02-architecture.md requires both
 * ("audit logging for any access to patient data" and "no PHI in logs").
 *
 * The wiring into the server actions is exercised by their own callers; what
 * can only be checked here is that the table behaves — that it is queryable by
 * subject, and that browser clients cannot read a word of it.
 */

const available = await isDatabaseAvailable();

if (!available) {
  describe.skip(`audit (no database at ${TEST_DATABASE_URL})`, () => {
    it("skipped", () => {});
  });
}

const STAFF = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe.runIf(available)("audit_log", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.sql`truncate audit_log`;
  });

  async function write(over: Record<string, unknown> = {}) {
    const [row] = await db.sql`
      insert into audit_log ${db.sql({
        actor_id: STAFF,
        actor_email: "nurse@clinic.mm",
        actor_role: "staff",
        action: "patient.view",
        subject_type: "patient",
        subject_id: "patient-1",
        ...over,
      })}
      returning id
    `;
    return row.id as string;
  }

  it("stores an entry with its actor and subject", async () => {
    await write();
    const [row] = await db.sql<
      { action: string; actor_email: string; subject_id: string }[]
    >`select action, actor_email, subject_id from audit_log`;
    expect(row.action).toBe("patient.view");
    expect(row.actor_email).toBe("nurse@clinic.mm");
    expect(row.subject_id).toBe("patient-1");
  });

  it("allows a system action with no actor", async () => {
    // The reminder cron has no session user; the trail must still accept it
    // rather than dropping the entry.
    await write({ actor_id: null, actor_email: null, actor_role: null });
    const rows = await db.sql`select 1 from audit_log where actor_id is null`;
    expect(rows).toHaveLength(1);
  });

  it("answers 'who accessed this patient's record?'", async () => {
    await write({ subject_id: "patient-1", actor_email: "a@clinic.mm" });
    await write({ subject_id: "patient-1", actor_email: "b@clinic.mm" });
    await write({ subject_id: "patient-2", actor_email: "c@clinic.mm" });

    const rows = await db.sql<{ actor_email: string }[]>`
      select actor_email from audit_log
      where subject_type = 'patient' and subject_id = 'patient-1'
      order by at
    `;
    expect(rows.map((r) => r.actor_email)).toEqual([
      "a@clinic.mm",
      "b@clinic.mm",
    ]);
  });

  it("answers 'what did this staff member do?'", async () => {
    await write({ action: "patient.view" });
    await write({ action: "patient.export", subject_id: null });
    await write({ actor_id: "dddddddd-dddd-dddd-dddd-dddddddddddd" });

    const rows = await db.sql<{ action: string }[]>`
      select action from audit_log where actor_id = ${STAFF} order by at
    `;
    expect(rows.map((r) => r.action)).toEqual([
      "patient.view",
      "patient.export",
    ]);
  });

  it("accepts every action in the module's vocabulary", async () => {
    for (const action of AUDIT_ACTIONS) {
      await write({ action, subject_type: "patient" });
    }
    const [{ count }] = await db.sql<{ count: string }[]>`
      select count(*)::text from audit_log
    `;
    expect(Number(count)).toBe(AUDIT_ACTIONS.length);
  });

  it("keeps non-PHI metadata queryable", async () => {
    await write({
      action: "patient.list",
      subject_id: null,
      metadata: db.sql.json({ returned: 25, total: 310, searched: true }),
    });
    const [row] = await db.sql<{ total: number }[]>`
      select (metadata->>'total')::int as total from audit_log
    `;
    expect(row.total).toBe(310);
  });

  it("survives the audited patient being deleted", async () => {
    // Deliberately no foreign key: the trail has to outlive the record, or
    // deleting a patient would erase the evidence of who had read it.
    const [p] = await db.sql`
      insert into patients (full_name, phone) values ('Temp', '0977000009') returning id
    `;
    await write({ subject_id: p.id });
    await db.sql`delete from patients where id = ${p.id}`;
    const rows = await db.sql`select 1 from audit_log where subject_id = ${p.id}`;
    expect(rows).toHaveLength(1);
  });

  describe("visibility", () => {
    it("is unreadable by browser clients", async () => {
      // RLS on, no policies. The log names which staff member looked at what —
      // it must not be browsable from a patient's or a receptionist's browser.
      await write();
      for (const role of ["authenticated", "anon"] as const) {
        await db.asRole(role);
        const rows = await db.sql`select * from audit_log`;
        await db.asRole(null);
        expect(rows, role).toHaveLength(0);
      }
    });

    it("cannot be written or forged by a browser client", async () => {
      await db.asRole("authenticated");
      await expect(
        db.sql`insert into audit_log (action, subject_type)
               values ('staff.role', 'staff')`
      ).rejects.toThrow();
      await db.asRole(null);
    });

    it("cannot be erased by a browser client", async () => {
      await write();
      await db.asRole("authenticated");
      await db.sql`delete from audit_log`.catch(() => {});
      await db.asRole(null);
      // Whether it errors or silently affects nothing, the row must remain.
      const rows = await db.sql`select 1 from audit_log`;
      expect(rows).toHaveLength(1);
    });
  });
});
