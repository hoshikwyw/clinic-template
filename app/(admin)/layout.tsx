import { Toaster } from "sonner";
import { getTranslations } from "next-intl/server";
import { getSessionUser, isAdmin, isStaff } from "@auth";
import { AdminNav } from "./admin-nav";
import { RealtimeNotifier } from "./realtime-notifier";

/**
 * Admin Dashboard shell — wraps everything under this route group.
 *
 * Used by the clinic admin team. WEB ONLY (not packaged into Android), but
 * fully responsive / mobile-friendly. Sidebar on desktop collapses on mobile.
 * See docs/05-web-mobile-strategy.md.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const t = await getTranslations("admin");
  const user = await getSessionUser();
  const staff = user ? isStaff(user.role) : false;

  return (
    <div className="flex min-h-dvh flex-col sm:flex-row">
      <aside className="flex flex-col gap-3 border-b border-border p-4 dark:border-zinc-800 sm:w-56 sm:shrink-0 sm:border-b-0 sm:border-r">
        <span className="text-sm font-semibold">{t("dashboard")}</span>
        <AdminNav isAdmin={user ? isAdmin(user.role) : false} />
      </aside>
      <main className="min-w-0 flex-1 p-4">{children}</main>
      <Toaster position="top-right" richColors />
      {/* Live new-appointment alerts for staff (Supabase Realtime). */}
      {staff && <RealtimeNotifier />}
    </div>
  );
}
