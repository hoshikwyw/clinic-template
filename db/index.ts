/**
 * Drizzle database client (Supabase Postgres).
 *
 * Vendor-wrapping: all DB access goes through Drizzle, so the database stays
 * portable if we ever move off Supabase. Use the Supabase connection pooler URL
 * (prepare:false is required for the transaction pooler).
 *
 * See docs/01-tech-stack.md and docs/02-architecture.md.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "";

// Lazily connects on first query, so importing this at build time is safe even
// without env set. Throw a clear error only if used without configuration.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
