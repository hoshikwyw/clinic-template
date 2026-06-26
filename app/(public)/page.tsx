import Link from "next/link";
import { Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getClinicConfig } from "@/config/clinic";
import { formatOpenDays } from "@/lib/hours";
import { Button } from "@ui/primitives/button";

/**
 * Public site — "/" (SSR, SEO). A real, branded clinic homepage built entirely
 * from the clinic config. Branding colors are applied globally (root layout).
 */
export default async function PublicHome() {
  const config = getClinicConfig();
  const { branding, services, businessHours, locale, specialty } = config;
  const t = await getTranslations("public");
  const tset = await getTranslations("settings");
  const th = await getTranslations("help");
  const dayNames = t.raw("dayNames") as string[];

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 py-4">
        <span className="font-semibold text-primary">
          {branding.shortName ?? branding.name}
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            aria-label={tset("title")}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-5" aria-hidden />
          </Link>
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

      <footer className="border-t border-border py-6 text-sm">
        <Link href="/help" className="text-primary hover:underline">
          {th("title")}
        </Link>
      </footer>
    </main>
  );
}
