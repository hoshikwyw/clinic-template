import { defineConfig } from "vitest/config";

/**
 * Integration tests — the ones that need a real Postgres.
 *
 * Separate from vitest.config.ts because they have different requirements:
 * they need a database, they take seconds rather than milliseconds, and they
 * must not run in parallel. Contributors without Docker still get a green
 * `pnpm test`; these skip themselves when no database is reachable.
 *
 *   docker run -d --rm --name clinic-test-pg -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_DB=clinic_test -p 55433:5432 postgres:16-alpine
 *   pnpm test:integration
 */
export default defineConfig({
  // Vitest never serves static assets, so skip Vite's scan of public/ — it is
  // pure startup cost here.
  publicDir: false,
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // Each file rebuilds the schema from the migrations, so two running at once
    // would fight over it. Sequential is correct, not merely safer.
    fileParallelism: false,
    // Applying eight migrations from empty is slower than a unit test.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
