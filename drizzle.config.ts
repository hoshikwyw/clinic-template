import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config — migrations live in db/migrations, schema in db/schema.
 * Run with DATABASE_URL set in the environment (see .env.example).
 */
export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
