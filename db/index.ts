/**
 * Drizzle database client (Supabase Postgres).
 *
 * Vendor-wrapping: all DB access goes through Drizzle, so the database stays
 * portable if we ever move off Supabase. Use the Supabase connection pooler URL
 * (prepare:false is required for the transaction pooler).
 *
 * See docs/01-tech-stack.md and docs/02-architecture.md.
 */
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Schema = typeof schema;
type Database = PostgresJsDatabase<Schema>;

// Cache the pool + db on globalThis so Next dev HMR (which re-imports this
// module on every hot reload) reuses one pool instead of leaking a new one
// each time.
const globalForDb = globalThis as unknown as {
  __clinicSql?: ReturnType<typeof postgres>;
  __clinicDb?: Database;
};

function createDb(): Database {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Configure it in .env.local (use the Supabase " +
        "transaction pooler connection string)."
    );
  }

  const sql =
    globalForDb.__clinicSql ??
    postgres(connectionString, {
      // Required for the Supabase transaction pooler.
      prepare: false,
      // One connection per instance: friendly to the pooler and to serverless
      // (each function instance holds at most one connection).
      max: 1,
      idle_timeout: 20,
    });

  if (process.env.NODE_ENV !== "production") globalForDb.__clinicSql = sql;
  return drizzle(sql, { schema });
}

// Lazy singleton via Proxy: the pool is created on first query, not at import,
// so importing this module at build time (before env is set) stays safe — while
// callers still get a clear error the moment they actually run a query without
// DATABASE_URL configured. The `db` export API is unchanged.
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const instance =
      globalForDb.__clinicDb ?? (globalForDb.__clinicDb = createDb());
    return Reflect.get(instance, prop, receiver);
  },
});

export { schema };
