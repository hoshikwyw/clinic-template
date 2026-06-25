/**
 * Admin Dashboard shell — wraps everything under this route group.
 *
 * Used by the clinic admin team. WEB ONLY (not packaged into Android), but
 * fully responsive / mobile-friendly. Sidebar on desktop collapses on mobile.
 * See docs/05-web-mobile-strategy.md.
 * NOTE: Phase 0 placeholder shell.
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col sm:flex-row">
      <aside className="border-b border-zinc-200 p-4 dark:border-zinc-800 sm:w-56 sm:border-b-0 sm:border-r">
        <span className="text-sm font-semibold">Admin Dashboard</span>
      </aside>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
