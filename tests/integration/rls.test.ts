import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createTestDb,
  isDatabaseAvailable,
  TEST_DATABASE_URL,
  type TestDb,
} from "../helpers/test-db";

/**
 * Row-level security policy tests.
 *
 * docs/02-architecture.md lists role-based RLS as a non-negotiable — "enforced
 * at the database, never trust the app layer alone". Until now the policies had
 * never been executed by anything: the app's own queries run on a trusted
 * connection that bypasses RLS entirely, so a policy could have been silently
 * wrong since the day it was written and nothing would have noticed.
 *
 * These run as the `authenticated` role with the same request GUCs Supabase
 * populates from a verified JWT, which is exactly the path a patient's browser
 * takes (PostgREST, and the Realtime subscriptions the portal uses).
 */

const available = await isDatabaseAvailable();

if (!available) {
  describe.skip(`RLS (no database at ${TEST_DATABASE_URL})`, () => {
    it("skipped", () => {});
  });
}

const ALICE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe.runIf(available)("row-level security", () => {
  let db: TestDb;
  let alicePatient: string;
  let bobPatient: string;

  beforeAll(async () => {
    db = await createTestDb();
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.truncate();

    // Seeded as the owner (RLS bypassed), mirroring the app's trusted writes.
    const [a] = await db.sql`
      insert into patients (auth_user_id, full_name, phone)
      values (${ALICE}, 'Alice', '0977000001') returning id
    `;
    const [b] = await db.sql`
      insert into patients (auth_user_id, full_name, phone)
      values (${BOB}, 'Bob', '0977000002') returning id
    `;
    const [g] = await db.sql`
      insert into patients (full_name, phone)
      values ('Guest', '0977000003') returning id
    `;
    alicePatient = a.id;
    bobPatient = b.id;

    for (const [pid, at] of [
      [alicePatient, "2026-10-01T09:00:00.000Z"],
      [bobPatient, "2026-10-01T10:00:00.000Z"],
      [g.id, "2026-10-01T11:00:00.000Z"],
    ] as const) {
      await db.sql`
        insert into appointments
          (patient_id, service_id, service_name, start_at, end_at, status)
        values (${pid}, 'checkup', 'Check-up', ${at}, ${at}, 'confirmed')
      `;
    }
  });

  /** Run a query as a signed-in patient. */
  async function asPatient<T>(
    userId: string,
    run: () => Promise<T>,
    claims: Record<string, unknown> = {}
  ): Promise<T> {
    await db.asUser(userId, claims);
    await db.asRole("authenticated");
    try {
      return await run();
    } finally {
      await db.asRole(null);
    }
  }

  // -------------------------------------------------------------------------
  describe("patients", () => {
    it("shows a patient only their own record", async () => {
      const rows = await asPatient(ALICE, () =>
        db.sql<{ full_name: string }[]>`select full_name from patients`
      );
      expect(rows.map((r) => r.full_name)).toEqual(["Alice"]);
    });

    it("hides guest records from every signed-in patient", async () => {
      // A guest row has auth_user_id null, and `auth.uid() = null` is never
      // true — so guests are invisible to the browser client by construction.
      const rows = await asPatient(BOB, () =>
        db.sql<{ full_name: string }[]>`select full_name from patients`
      );
      expect(rows.map((r) => r.full_name)).toEqual(["Bob"]);
    });

    it("shows nothing to an unauthenticated caller", async () => {
      await db.asRole("anon");
      const rows = await db.sql`select * from patients`;
      await db.asRole(null);
      expect(rows).toHaveLength(0);
    });

    it("stops a patient updating someone else's record", async () => {
      await asPatient(ALICE, async () => {
        await db.sql`update patients set full_name = 'Hacked' where id = ${bobPatient}`;
      });
      // The UPDATE is silently scoped to nothing rather than erroring — what
      // matters is that Bob's row is untouched.
      const [bob] = await db.sql<{ full_name: string }[]>`
        select full_name from patients where id = ${bobPatient}
      `;
      expect(bob.full_name).toBe("Bob");
    });

    it("lets a patient update their own record", async () => {
      await asPatient(ALICE, async () => {
        await db.sql`update patients set full_name = 'Alice A' where id = ${alicePatient}`;
      });
      const [alice] = await db.sql<{ full_name: string }[]>`
        select full_name from patients where id = ${alicePatient}
      `;
      expect(alice.full_name).toBe("Alice A");
    });
  });

  // -------------------------------------------------------------------------
  describe("appointments", () => {
    it("shows a patient only their own appointments", async () => {
      const rows = await asPatient(
        ALICE,
        () => db.sql`select id from appointments`
      );
      expect(rows).toHaveLength(1);
    });

    it("shows all appointments to staff via the app_metadata role", async () => {
      // This policy is what lets the admin dashboard's Realtime subscription
      // receive new-booking events at all.
      for (const role of ["admin", "doctor", "staff"]) {
        const rows = await asPatient(
          ALICE,
          () => db.sql`select id from appointments`,
          { app_metadata: { role } }
        );
        expect(rows, `role ${role}`).toHaveLength(3);
      }
    });

    it("does not treat an unknown role as staff", async () => {
      const rows = await asPatient(
        ALICE,
        () => db.sql`select id from appointments`,
        { app_metadata: { role: "patient" } }
      );
      expect(rows).toHaveLength(1);
    });

    it("ignores a role planted in user_metadata", async () => {
      // The whole reason authorization reads app_metadata: user_metadata is
      // self-editable, so a patient claiming to be an admin there must get
      // nowhere.
      const rows = await asPatient(
        ALICE,
        () => db.sql`select id from appointments`,
        { user_metadata: { role: "admin" }, app_metadata: {} }
      );
      expect(rows).toHaveLength(1);
    });

    it("shows nothing to an unauthenticated caller", async () => {
      await db.asRole("anon");
      const rows = await db.sql`select * from appointments`;
      await db.asRole(null);
      expect(rows).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("rate_limits", () => {
    it("is invisible to browser clients", async () => {
      // RLS is enabled with NO policies, which denies everything. Only the
      // trusted server connection touches this table.
      for (const role of ["authenticated", "anon"] as const) {
        await db.asRole(role);
        const rows = await db.sql`select * from rate_limits`;
        await db.asRole(null);
        expect(rows, role).toHaveLength(0);
      }
    });

    it("cannot be written by a browser client", async () => {
      await db.asRole("authenticated");
      // No INSERT policy exists, so the write is refused outright.
      await expect(
        db.sql`insert into rate_limits (key, count) values ('x', 1)`
      ).rejects.toThrow();
      await db.asRole(null);
    });
  });
});
