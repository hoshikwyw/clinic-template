import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config — wraps the Patient/Staff app into a native Android app.
 * (Admin Dashboard is web-only and is NOT packaged.)
 *
 * Strategy: REMOTE-URL pattern. Our app is an online SaaS (SSR + server
 * actions), so we don't statically export it. Instead the native shell loads
 * the live Patient/Staff app, keeping full Next.js features while still
 * exposing native push/camera via Capacitor plugins (see packages/native).
 *
 *   Dev:  set server.url to your machine's LAN IP, e.g.
 *         http://192.168.1.20:3000/portal  (run `pnpm dev` first)
 *   Prod: set server.url to the deployed app, e.g.
 *         https://app.yourclinic.com/portal
 *
 * See docs/05-web-mobile-strategy.md.
 */
const config: CapacitorConfig = {
  appId: "com.clinicplatform.app",
  appName: "Clinic Platform",
  // Fallback shell, shown only if no server.url is set (offline splash).
  webDir: "packages/native/www",
  server: {
    androidScheme: "https",
    // url: "http://192.168.1.20:3000/portal", // <- set per environment
    // cleartext: true, // enable only for http during local dev
  },
};

export default config;
