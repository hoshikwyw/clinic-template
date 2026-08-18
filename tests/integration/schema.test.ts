import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createTestDb,
  isDatabaseAvailable,
  migrationFiles,
  TEST_DATABASE_URL,
  type TestDb,
} from "../helpers/test-db";

/**
 * Database-level integration tests.
 *
 * Everything here is a claim the application code *relies on* but cannot prove:
 * the partial unique index really is what stops a double booking, cancelling
 * really does free the slot, the rate-limit upsert really counts per window,
 * and the migration chain really does apply from empty. Until now all of that
 * was asserted only in comments.
 *
 * Needs a throwaway Postgres (see tests/helpers/test-db.ts). Skips — loudly —
 * rather than failing when there isn't one, so `pnpm test` still passes on a
 * machine without Docker.
 */

const available = await isDatabaseAvailable();

if (!available) {
  describe.skip(`integration (no database at ${TEST_DATABASE_URL})`, () => {
    it("skipped", () => {});
  });
}

describe.runIf(available)("database integration", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.truncate();
  });

  /** Insert a patient and return its id. */
  async function newPatient(over: Record<string, unknown> = {}) {
    const [row] = await db.sql`
      insert into patients ${db.sql({
        full_name: "Test Patient",
        phone: "09771234567",
        ...over,
      })}
      returning id
    `;
    return row.id as string;
  }

  async function book(
    patientId: string,
    opts: { at: string; provider?: string; status?: string }
  ) {
    return db.sql`
      insert into appointments ${db.sql({
        patient_id: patientId,
        service_id: "checkup",
        service_name: "Check-up",
        provider_id: opts.provider ?? "clinic",
        start_at: opts.at,
        end_at: opts.at,
        status: opts.status ?? "pending",
      })}
      returning id
    `;
  }

  // -------------------------------------------------------------------------
  describe("migrations", () => {
    it("applies the whole chain from an empty database", () => {
      // createTestDb() in beforeAll did exactly this; reaching here proves it.
      expect(migrationFiles().length).toBeGreaterThan(0);
    });

    it("leaves the tables the app expects", async () => {
      const rows = await db.sql<{ table_name: string }[]>`
        select table_name from information_schema.tables
        where table_schema = 'public' order by table_name
      `;
      expect(rows.map((r) => r.table_name)).toEqual([
        "appointments",
        "audit_log",
        "patients",
        "rate_limits",
      ]);
    });

    it("has row-level security on every table holding patient data", async () => {
      const rows = await db.sql<{ relname: string; relrowsecurity: boolean }[]>`
        select relname, relrowsecurity from pg_class
        where relname in ('patients', 'appointments', 'rate_limits', 'audit_log')
      `;
      for (const r of rows) expect(r.relrowsecurity).toBe(true);
    });

    it("carries the full appointment_status enum", async () => {
      const rows = await db.sql<{ label: string }[]>`
        select unnest(enum_range(null::appointment_status))::text as label
      `;
      expect(rows.map((r) => r.label).sort()).toEqual([
        "cancelled",
        "completed",
        "confirmed",
        "no_show",
        "pending",
      ]);
    });
  });

  // -------------------------------------------------------------------------
  describe("appointments_active_slot_unique", () => {
    const AT = "2026-09-01T09:00:00.000Z";

    it("prevents two active bookings for one provider at one time", async () => {
      const a = await newPatient();
      const b = await newPatient();
      await book(a, { at: AT, provider: "dr-one" });

      // This is THE guarantee the whole booking flow leans on.
      await expect(book(b, { at: AT, provider: "dr-one" })).rejects.toMatchObject(
        { code: "23505" }
      );
    });

    it("allows the same time on different providers", async () => {
      const a = await newPatient();
      const b = await newPatient();
      await book(a, { at: AT, provider: "dr-one" });
      // The entire point of the providers work: parallel calendars.
      await expect(book(b, { at: AT, provider: "dr-two" })).resolves.toBeDefined();
    });

    it("frees the slot when an appointment is cancelled", async () => {
      const a = await newPatient();
      const b = await newPatient();
      const [appt] = await book(a, { at: AT, provider: "dr-one" });
      await db.sql`update appointments set status = 'cancelled' where id = ${appt.id}`;
      await expect(book(b, { at: AT, provider: "dr-one" })).resolves.toBeDefined();
    });

    it("frees the slot on a no-show", async () => {
      // no_show is terminal like cancelled — the index predicate must agree
      // with OCCUPYING_STATUSES in the app, or the two drift apart.
      const a = await newPatient();
      const b = await newPatient();
      const [appt] = await book(a, { at: AT, provider: "dr-one" });
      await db.sql`update appointments set status = 'no_show' where id = ${appt.id}`;
      await expect(book(b, { at: AT, provider: "dr-one" })).resolves.toBeDefined();
    });

    it("still blocks on a completed appointment", async () => {
      const a = await newPatient();
      const b = await newPatient();
      const [appt] = await book(a, { at: AT, provider: "dr-one" });
      await db.sql`update appointments set status = 'completed' where id = ${appt.id}`;
      await expect(book(b, { at: AT, provider: "dr-one" })).rejects.toMatchObject(
        { code: "23505" }
      );
    });

    it("allows many cancelled appointments in the same slot", async () => {
      const a = await newPatient();
      for (let i = 0; i < 3; i++) {
        const [appt] = await book(a, { at: AT, provider: "dr-one" });
        await db.sql`update appointments set status = 'cancelled' where id = ${appt.id}`;
      }
      // A partial unique index must not accumulate conflicts among the rows it
      // excludes, or a well-used slot would eventually become unbookable.
      await expect(book(a, { at: AT, provider: "dr-one" })).resolves.toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  describe("patients_auth_user_id_unique", () => {
    it("allows many guests with no account", async () => {
      await newPatient({ auth_user_id: null });
      // NULLs must stay distinct here, or guest booking breaks entirely.
      await expect(newPatient({ auth_user_id: null })).resolves.toBeDefined();
    });

    it("prevents two patient rows for one account", async () => {
      const uid = "11111111-1111-1111-1111-111111111111";
      await newPatient({ auth_user_id: uid });
      await expect(newPatient({ auth_user_id: uid })).rejects.toMatchObject({
        code: "23505",
      });
    });
  });

  // -------------------------------------------------------------------------
  describe("cascade", () => {
    it("removes a patient's appointments with them", async () => {
      // seed-demo --clean relies on exactly this.
      const p = await newPatient();
      await book(p, { at: "2026-09-02T09:00:00.000Z" });
      await db.sql`delete from patients where id = ${p}`;
      const rows = await db.sql`select 1 from appointments`;
      expect(rows).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("rate_limits fixed-window upsert", () => {
    /** The exact statement lib/rate-limit.ts issues. */
    async function hit(key: string, windowSeconds: number) {
      const rows = await db.sql<{ count: number; elapsed: number }[]>`
        insert into rate_limits (key, count, window_start)
        values (${key}, 1, now())
        on conflict (key) do update set
          count = case
            when rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds}::double precision)
            then 1
            else rate_limits.count + 1
          end,
          window_start = case
            when rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds}::double precision)
            then now()
            else rate_limits.window_start
          end
        returning
          rate_limits.count,
          extract(epoch from (now() - rate_limits.window_start))::int as elapsed
      `;
      return rows[0];
    }

    it("counts attempts within the window", async () => {
      expect((await hit("booking:ip:x", 600)).count).toBe(1);
      expect((await hit("booking:ip:x", 600)).count).toBe(2);
      expect((await hit("booking:ip:x", 600)).count).toBe(3);
    });

    it("keeps separate keys separate", async () => {
      await hit("a", 600);
      await hit("a", 600);
      expect((await hit("b", 600)).count).toBe(1);
    });

    it("resets once the window has passed", async () => {
      await hit("expiring", 600);
      await hit("expiring", 600);
      // Age the window rather than sleeping.
      await db.sql`
        update rate_limits set window_start = now() - interval '11 minutes'
        where key = 'expiring'
      `;
      const after = await hit("expiring", 600);
      expect(after.count).toBe(1);
      expect(after.elapsed).toBeLessThan(2);
    });

    it("reports elapsed time so a Retry-After can be computed", async () => {
      await hit("elapsed", 600);
      await db.sql`
        update rate_limits set window_start = now() - interval '90 seconds'
        where key = 'elapsed'
      `;
      const r = await hit("elapsed", 600);
      expect(r.elapsed).toBeGreaterThanOrEqual(89);
      expect(r.count).toBe(2);
    });

    it("prunes only counters older than the cutoff", async () => {
      await hit("old", 600);
      await hit("fresh", 600);
      await db.sql`
        update rate_limits set window_start = now() - interval '2 days' where key = 'old'
      `;
      await db.sql`
        delete from rate_limits
        where window_start <= now() - make_interval(secs => ${86400}::double precision)
      `;
      const rows = await db.sql<{ key: string }[]>`select key from rate_limits`;
      expect(rows.map((r) => r.key)).toEqual(["fresh"]);
    });
  });

  // -------------------------------------------------------------------------
  describe("per-patient daily cap query", () => {
    /** The clinic-timezone day comparison from createAppointment. */
    async function usedOnDay(patientId: string, startIso: string, tz: string) {
      const [row] = await db.sql<{ used: number }[]>`
        select count(*)::int as used from appointments
        where patient_id = ${patientId}
          and status::text not in ('cancelled', 'no_show')
          and (start_at AT TIME ZONE ${tz})::date
              = (${startIso}::timestamptz AT TIME ZONE ${tz})::date
      `;
      return row.used;
    }

    it("counts appointments on the same clinic-local day", async () => {
      const p = await newPatient();
      await book(p, { at: "2026-09-01T02:30:00.000Z" }); // 09:00 Yangon
      await book(p, { at: "2026-09-01T08:30:00.000Z" }); // 15:00 Yangon
      expect(await usedOnDay(p, "2026-09-01T04:00:00.000Z", "Asia/Yangon")).toBe(2);
    });

    it("uses the clinic's day boundary, not UTC's", async () => {
      // 20:00 UTC on Aug 31 is 02:30 on Sep 1 in Yangon (UTC+6:30). A UTC-based
      // comparison would put these on different days and let the cap be
      // bypassed by booking late in the evening.
      const p = await newPatient();
      await book(p, { at: "2026-08-31T20:00:00.000Z" });
      expect(await usedOnDay(p, "2026-09-01T04:00:00.000Z", "Asia/Yangon")).toBe(1);
      expect(await usedOnDay(p, "2026-08-31T04:00:00.000Z", "Asia/Yangon")).toBe(0);
    });

    it("ignores cancelled and no-show appointments", async () => {
      const p = await newPatient();
      const [a] = await book(p, { at: "2026-09-01T02:30:00.000Z" });
      const [b] = await book(p, { at: "2026-09-01T03:30:00.000Z" });
      await db.sql`update appointments set status = 'cancelled' where id = ${a.id}`;
      await db.sql`update appointments set status = 'no_show' where id = ${b.id}`;
      expect(await usedOnDay(p, "2026-09-01T04:00:00.000Z", "Asia/Yangon")).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("guest dedupe lookup", () => {
    it("matches a guest on the normalised phone and never a registered patient", async () => {
      await newPatient({
        auth_user_id: null,
        phone: "09 771 234 567",
        phone_normalized: "959771234567",
      });
      await newPatient({
        auth_user_id: "22222222-2222-2222-2222-222222222222",
        phone: "+959771234567",
        phone_normalized: "959771234567",
      });

      const rows = await db.sql<{ id: string }[]>`
        select id from patients
        where auth_user_id is null and phone_normalized = '959771234567'
      `;
      // The registered patient shares the number but must never be adopted by a
      // guest booking.
      expect(rows).toHaveLength(1);
    });
  });
});
