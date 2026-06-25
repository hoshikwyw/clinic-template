import Link from "next/link";
import { getClinicConfig } from "@/config/clinic";
import { AccessibilityToolbar } from "@ui";
import { Button } from "@ui/primitives/button";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatOpenDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  // Compact consecutive runs into ranges, e.g. [1,2,3,4,5] -> "Mon–Fri".
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    parts.push(
      start === prev
        ? DAY_NAMES[start]
        : `${DAY_NAMES[start]}–${DAY_NAMES[prev]}`
    );
    start = sorted[i];
    prev = sorted[i];
  }
  return parts.join(", ");
}

/**
 * Public site — "/" (SSR, SEO). A real, branded clinic homepage built entirely
 * from the clinic config. Branding colors are applied globally (root layout).
 */
export default function PublicHome() {
  const config = getClinicConfig();
  const { branding, services, businessHours, locale, specialty } = config;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 py-4">
        <span className="font-semibold text-primary">
          {branding.shortName ?? branding.name}
        </span>
        <div className="flex items-center gap-3">
          <AccessibilityToolbar />
          <Link
            href="/login"
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="space-y-5 py-10 text-center sm:py-16">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          {specialty} clinic
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          {branding.name}
        </h1>
        <p className="mx-auto max-w-md text-lg text-muted-foreground">
          Book an appointment online in under a minute — no account needed.
        </p>
        <div className="flex justify-center pt-2">
          <Link href="/portal">
            <Button size="lg" className="min-h-12 px-8 text-base">
              Book an appointment
            </Button>
          </Link>
        </div>
      </section>

      {/* Services */}
      <section className="space-y-4 py-8">
        <h2 className="text-xl font-semibold">Our services</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-border p-4"
            >
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-muted-foreground">
                {s.durationMinutes} min
                {s.price
                  ? ` · ${s.price.toLocaleString()} ${locale.currency}`
                  : ""}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hours */}
      <section className="space-y-2 py-8">
        <h2 className="text-xl font-semibold">Opening hours</h2>
        <p className="text-muted-foreground">
          {formatOpenDays(businessHours.openDays)} ·{" "}
          {businessHours.openTime}–{businessHours.closeTime}
        </p>
      </section>
    </main>
  );
}
