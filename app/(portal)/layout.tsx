/**
 * Patient / Staff app shell — wraps everything under this route group.
 *
 * This is the ONE role-aware app (patient vs doctor vs staff views gated by
 * role + RLS). It is the zone Capacitor packages into Android + PWA.
 *
 * Adaptive shell: bottom navigation on mobile (thumb-reachable) <-> sidebar on
 * desktop. Mobile-first, WCAG 2.1 AA. See docs/04-ui-ux-system.md.
 * NOTE: Phase 0 placeholder shell — real nav comes with packages/ui/shell.
 */
export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="text-sm font-semibold">Patient / Staff app</span>
      </header>
      <main className="flex-1 p-4 pb-24">{children}</main>
      {/* Mobile bottom nav placeholder (thumb-reachable, 44px+ targets) */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 grid grid-cols-3 border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90 sm:hidden"
      >
        {["Home", "Appointments", "Profile"].map((item) => (
          <button
            key={item}
            className="flex min-h-14 items-center justify-center text-xs font-medium"
          >
            {item}
          </button>
        ))}
      </nav>
    </div>
  );
}
