import { defineConfig } from "vitest/config";

/**
 * Vitest config — fast unit tests, no external services.
 *
 * Vite resolves our "@/..." tsconfig path aliases natively, so tests import the
 * same way app code does. Pure-logic tests run in the node env.
 *
 * Tests that need a real Postgres live in tests/integration and run under
 * vitest.integration.config.ts (`pnpm test:integration`) — they are excluded
 * here so `pnpm test` stays fast and needs nothing installed.
 */
export default defineConfig({
  // Vitest never serves static assets, so skip Vite's scan of public/ — it is
  // pure startup cost here.
  publicDir: false,
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**"],
  },
});
