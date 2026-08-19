import Link from "next/link";
import { Settings } from "lucide-react";
import { Toaster } from "sonner";
import { getTranslations } from "next-intl/server";
import { getClinicConfig } from "@/config/clinic";
import { getSessionUser } from "@auth";
import { PortalNav } from "./portal-nav";
import { PatientRealtimeNotifier } from "./patient-realtime";

/**
 * Patient / Staff app shell — wraps everything under this route group.
 *
 * This is the ONE role-aware app (patient vs doctor vs staff views gated by
 * role + RLS). It is the zone Capacitor packages into Android + PWA.
 *
 * Mobile-first, WCAG 2.1 AA. Logged-in patients get the bottom nav
 * (Home / Appointments / Profile / Settings); guests get a Settings link in the
 * header. See docs/04-ui-ux-system.md.
 */
export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const config = getClinicConfig();
  const user = await getSessionUser();
  const t = await getTranslations("settings");

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
        {/* Logged-in users reach Settings via the bottom nav; guests need it here. */}
        {!user && (
          <Link
            href="/settings"
            aria-label={t("title")}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-5" aria-hidden />
          </Link>
        )}
      </header>
      <main
        className={`mx-auto w-full max-w-2xl flex-1 p-4 ${user ? "pb-24" : ""}`}
      >
        {children}
      </main>
      {user && <PortalNav />}
      <Toaster position="top-center" richColors />
      {user && <PatientRealtimeNotifier />}
    </div>
  );
}
