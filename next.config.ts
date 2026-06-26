import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Allow a separate build dir per dev server, so `npm run app` (5173) and
  // `npm run dash` (5174) can run at the same time without corrupting each
  // other's .next cache. Defaults to .next when NEXT_DIST_DIR is unset.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

// Cookie-based i18n (no routing). Points at the request config above.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
