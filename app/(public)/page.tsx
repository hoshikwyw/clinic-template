import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getClinicConfig } from "@/config/clinic";
import { AccessibilityToolbar } from "@ui";
import { Button } from "@ui/primitives/button";

function formatOpenDays(days: number[], dayNames: string[]): string {
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
        ? dayNames[start]
        : `${dayNames[start]}–${dayNames[prev]}`
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
export default async function PublicHome() {
  const config = getClinicConfig();
  const { branding, services, businessHours, locale, specialty } = config;
  const t = await getTranslations("public");
  const dayNames = t.raw("dayNames") as string[];

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
            {t("logIn")}
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="space-y-5 py-10 text-center sm:py-16">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          {specialty} {t("clinicSuffix")}
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          {branding.name}
        </h1>
        <p className="mx-auto max-w-md text-lg text-muted-foreground">
          {t("heroSubtitle")}
        </p>
        <div className="flex justify-center pt-2">
          <Link href="/portal">
            <Button size="lg" className="min-h-12 px-8 text-base">
              {t("bookCta")}
            </Button>
          </Link>
        </div>
      </section>

      {/* Services */}
      <section className="space-y-4 py-8">
        <h2 className="text-xl font-semibold">{t("servicesTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-border p-4"
            >
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-muted-foreground">
                {s.durationMinutes} {t("minUnit")}
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
        <h2 className="text-xl font-semibold">{t("hoursTitle")}</h2>
        <p className="text-muted-foreground">
          {formatOpenDays(businessHours.openDays, dayNames)} ·{" "}
          {businessHours.openTime}–{businessHours.closeTime}
        </p>
      </section>
    </main>
  );
}
