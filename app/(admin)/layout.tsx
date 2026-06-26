import { getTranslations } from "next-intl/server";
import { AccessibilityToolbar } from "@ui";

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

  return (
    <div className="flex min-h-dvh flex-col sm:flex-row">
      <aside className="flex items-center justify-between gap-2 border-b border-border p-4 dark:border-zinc-800 sm:w-56 sm:flex-col sm:items-start sm:border-b-0 sm:border-r">
        <span className="text-sm font-semibold">{t("dashboard")}</span>
        <AccessibilityToolbar />
      </aside>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
