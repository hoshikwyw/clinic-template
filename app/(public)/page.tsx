import Link from "next/link";

/**
 * Public site — "/" (SSR, SEO).
 * Pre-login landing / marketing / public booking entry.
 * See docs/05-web-mobile-strategy.md (the two apps + public site).
 */
export default function PublicHome() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
          Phase 0 · skeleton
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Clinic Platform</h1>
        <p className="mx-auto max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          One codebase + one config = any clinic. Web, PWA &amp; Android from a
          single foundation.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Link
          href="/portal"
          className="rounded-2xl border border-zinc-200 p-6 text-left transition-colors hover:border-zinc-400 dark:border-zinc-800"
        >
          <h2 className="text-lg font-semibold">Patient / Staff app →</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Patients, doctors &amp; staff. Web + PWA + Android. Role-aware.
          </p>
        </Link>
        <Link
          href="/admin"
          className="rounded-2xl border border-zinc-200 p-6 text-left transition-colors hover:border-zinc-400 dark:border-zinc-800"
        >
          <h2 className="text-lg font-semibold">Admin Dashboard →</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Clinic admin team. Web only, fully responsive.
          </p>
        </Link>
      </div>
    </main>
  );
}
