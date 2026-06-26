import { defineConfig } from "vitest/config";

/**
 * Vitest config. Vite resolves our "@/..." tsconfig path aliases natively, so
 * tests import the same way app code does. Pure-logic tests run in the node env.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
