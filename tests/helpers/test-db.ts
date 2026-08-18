import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

/**
 * A real Postgres for integration tests.
 *
 * Everything else in tests/ exercises pure functions. This exists for the half
 * of the system that only Postgres can answer: does the partial unique index
 * actually stop a double booking, does cancelling really free the slot, does the
 * rate-limit upsert count what we think it counts, and do the migrations still
 * apply in order from empty. Those are the highest-consequence pieces of the
 * codebase and none of them can be verified in JavaScript.
 *
 * Uses the `postgres` client the app already depends on — no new dependency.
 *
 * Point it at any throwaway database:
 *
 *   docker run -d --rm --name clinic-test-pg -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_DB=clinic_test -p 55433:5432 postgres:16-alpine
 *
 * Override the connection with TEST_DATABASE_URL (CI service containers).
 * Tests SKIP rather than fail when no database is reachable, so `pnpm test`
 * still works on a machine without Docker.
 */

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:test@127.0.0.1:55433/clinic_test";

/**
 * Stand-ins for the Supabase-managed objects the migrations reference.
 *
 * Deliberately faithful rather than stubbed away: `auth.uid()` and `auth.jwt()`
 * read the same request GUCs Supabase populates from the JWT, so an RLS policy
 * written against them behaves here exactly as it does in production and can be
 * exercised by setting the GUC. That is the only way to test the policies at
 * all — they are the "never trust the app layer" backstop.
 */
const SUPABASE_SHIMS = `
  create schema if not exists auth;

  do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role anon;          exception when duplicate_object then null; end $$;
  do $$ begin create role service_role;  exception when duplicate_object then null; end $$;

  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create or replace function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb,
      '{}'::jsonb
    )
  $$;

  do $$ begin
    create publication supabase_realtime;
  exception when duplicate_object then null; end $$;
`;

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

/** Migration files in the order drizzle recorded them. */
export function migrationFiles(): string[] {
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")
  ) as { entries: { idx: number; tag: string }[] };

  const onDisk = new Set(
    readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"))
  );

  return journal.entries
    .sort((a, b) => a.idx - b.idx)
    .map((e) => {
      const file = `${e.tag}.sql`;
      if (!onDisk.has(file)) {
        throw new Error(
          `Journal references ${file} but it is not in db/migrations — the migration chain is broken.`
        );
      }
      return file;
    });
}

/** Is a throwaway Postgres actually reachable? Used to skip, not fail. */
export async function isDatabaseAvailable(): Promise<boolean> {
  const sql = postgres(TEST_DATABASE_URL, {
    max: 1,
    prepare: false,
    connect_timeout: 3,
    onnotice: () => {},
  });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export interface TestDb {
  sql: postgres.Sql;
  /** Drop every row, keeping the schema — call between tests. */
  truncate(): Promise<void>;
  /** Act as a signed-in Supabase user for RLS checks. */
  asUser(userId: string | null, claims?: Record<string, unknown>): Promise<void>;
  /** Switch Postgres role — RLS is bypassed by the owner, so tests need this. */
  asRole(role: "authenticated" | "anon" | null): Promise<void>;
  close(): Promise<void>;
}

/**
 * Build the schema from scratch by applying the real migration files in order.
 *
 * Running the actual migrations rather than pushing the Drizzle schema is the
 * point: it proves the chain a production database will follow still works from
 * empty, which is the thing nobody discovers is broken until a launch.
 */
export async function createTestDb(): Promise<TestDb> {
  const sql = postgres(TEST_DATABASE_URL, {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });

  // Start from nothing so a re-run is never influenced by the last one.
  await sql.unsafe(`drop schema if exists public cascade; create schema public;`);
  await sql.unsafe(`drop schema if exists auth cascade;`);
  await sql.unsafe(`drop publication if exists supabase_realtime;`);
  await sql.unsafe(SUPABASE_SHIMS);

  for (const file of migrationFiles()) {
    const body = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const statements = body
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    // ONE TRANSACTION PER FILE, because that is how drizzle's migrator applies
    // them. Running the statements in autocommit instead would quietly hide a
    // whole class of bug — most importantly `ALTER TYPE ... ADD VALUE` sharing
    // a file with something that uses the new label, which Postgres refuses
    // inside the transaction that added it.
    try {
      await sql.begin(async (tx) => {
        for (const statement of statements) await tx.unsafe(statement);
      });
    } catch (err) {
      throw new Error(
        `Migration ${file} failed:\n${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // Supabase grants these to anon/authenticated by default. Without them RLS is
  // untestable: the role would be blocked by table privileges before any policy
  // was consulted, and every "denied" result would be a false pass.
  await sql.unsafe(`
    grant usage on schema public to authenticated, anon;
    grant select, insert, update, delete on all tables in schema public
      to authenticated, anon;
  `);

  return {
    sql,
    async truncate() {
      await sql.unsafe(`reset role`);
      // appointments cascade from patients; rate_limits is independent.
      await sql.unsafe(`truncate patients, rate_limits restart identity cascade`);
    },
    async asUser(userId, claims) {
      // Mirrors what Supabase's PostgREST sets from a verified JWT.
      await sql.unsafe(
        `select set_config('request.jwt.claim.sub', ${
          userId === null ? `''` : `'${userId}'`
        }, false)`
      );
      await sql.unsafe(
        `select set_config('request.jwt.claims', '${JSON.stringify(
          claims ?? {}
        )}', false)`
      );
    },
    async asRole(role) {
      // RLS does not apply to the table owner, so policy tests must drop into
      // the same role PostgREST uses for a logged-in patient.
      await sql.unsafe(role === null ? `reset role` : `set role ${role}`);
    },
    async close() {
      await sql.unsafe(`reset role`).catch(() => {});
      await sql.end({ timeout: 5 });
    },
  };
}
