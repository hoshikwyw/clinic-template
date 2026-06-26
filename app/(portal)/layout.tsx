import Link from "next/link";
import { getClinicConfig } from "@/config/clinic";
import { getSessionUser } from "@auth";
import { AccessibilityToolbar, LanguageSwitcher } from "@ui";
import { PortalNav } from "./portal-nav";

/**
 * Patient / Staff app shell — wraps everything under this route group.
 *
 * This is the ONE role-aware app (patient vs doctor vs staff views gated by
 * role + RLS). It is the zone Capacitor packages into Android + PWA.
 *
 * Mobile-first, WCAG 2.1 AA. The accessibility toolbar (text size + contrast)
 * lives here so it's reachable from every patient screen. Logged-in patients
 * get the bottom nav (Home / Appointments / Profile). See docs/04-ui-ux-system.md.
 */
export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const config = getClinicConfig();
  const user = await getSessionUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <Link
          href="/"
          className="text-sm font-semibold text-primary"
          aria-label="Home"
        >
          {config.branding.shortName ?? config.branding.name}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher languages={config.locale.languages} />
          <AccessibilityToolbar />
        </div>
      </header>
      <main
        className={`mx-auto w-full max-w-2xl flex-1 p-4 ${user ? "pb-24" : ""}`}
      >
        {children}
      </main>
      {user && <PortalNav />}
    </div>
  );
}
