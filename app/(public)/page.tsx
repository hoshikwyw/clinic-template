import Link from "next/link";
import {
  Settings,
  Phone,
  Mail,
  MapPin,
  Clock,
  CalendarPlus,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getClinicConfig } from "@/config/clinic";
import { formatOpenDays } from "@/lib/hours";
import { Button } from "@ui/primitives/button";

/** Initials for a doctor avatar (strips a leading "Dr."). */
function initials(name: string): string {
  return name
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Public site — "/" (SSR, SEO). A modern, branded clinic landing page built
 * entirely from the clinic config. Branding colors applied globally (root layout).
 */
export default async function PublicHome() {
  const config = getClinicConfig();
  const { branding, services, businessHours, locale, specialty, about, doctors, contact } =
    config;
  const t = await getTranslations("public");
  const tset = await getTranslations("settings");
  const th = await getTranslations("help");
  const dayNames = t.raw("dayNames") as string[];
  const brandInitial = (branding.shortName ?? branding.name)
    .trim()
    .charAt(0)
    .toUpperCase();
  const hours = `${formatOpenDays(businessHours.openDays, dayNames)} · ${businessHours.openTime}–${businessHours.closeTime}`;

  // Map: prefer precise coordinates, else geocode the address. No API key needed.
  const mapQuery = contact?.coordinates
    ? `${contact.coordinates.lat},${contact.coordinates.lng}`
    : contact?.address;
  const mapEmbedSrc = mapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`
    : null;
  const mapLink = mapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}`
    : null;

  return (
    <main className="w-full">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {brandInitial}
            </span>
            <span className="font-semibold">
              {branding.shortName ?? branding.name}
            </span>
          </Link>

          {/* Section nav (desktop) */}
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a
              href="#services"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("servicesTitle")}
            </a>
            {doctors.length > 0 && (
              <a
                href="#team"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("teamTitle")}
              </a>
            )}
            <a
              href="#contact"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("contactTitle")}
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline"
            >
              {t("logIn")}
            </Link>
            <Link href="/book">
              <Button size="sm" className="gap-1.5 rounded-lg shadow-sm">
                <CalendarPlus className="size-4" aria-hidden />
                {t("book")}
              </Button>
            </Link>
            <Link
              href="/settings"
              aria-label={tset("title")}
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="size-5" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/10 to-transparent">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center sm:py-24">
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
            {specialty} {t("clinicSuffix")}
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-primary sm:text-5xl">
            {branding.name}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
            {t("heroSubtitle")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/book">
              <Button size="lg" className="min-h-12 px-8 text-base">
                {t("bookCta")}
              </Button>
            </Link>
            {contact?.phone && (
              <a href={`tel:${contact.phone.replace(/\s+/g, "")}`}>
                <Button
                  variant="outline"
                  size="lg"
                  className="min-h-12 px-6 text-base"
                >
                  <Phone className="size-4" aria-hidden /> {t("call")}
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* About */}
      {about && (
        <section className="mx-auto max-w-3xl px-5 py-14 text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            {t("aboutTitle")}
          </h2>
          <p className="mt-4 text-muted-foreground">{about}</p>
        </section>
      )}

      {/* Services */}
      <section
        id="services"
        className="mx-auto max-w-5xl scroll-mt-20 px-5 py-14"
      >
        <h2 className="text-center text-2xl font-bold tracking-tight">
          {t("servicesTitle")}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-border p-5 transition-all hover:border-primary hover:shadow-sm"
            >
              <div className="font-semibold">{s.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {s.durationMinutes} {t("minUnit")}
              </div>
              {s.price ? (
                <div className="mt-3 text-sm font-medium text-primary">
                  {s.price.toLocaleString()} {locale.currency}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      {doctors.length > 0 && (
        <section id="team" className="scroll-mt-20 bg-muted/40">
          <div className="mx-auto max-w-5xl px-5 py-14">
            <h2 className="text-center text-2xl font-bold tracking-tight">
              {t("teamTitle")}
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map((d) => (
                <div
                  key={d.name}
                  className="rounded-2xl border border-border bg-background p-5"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                      {initials(d.name)}
                    </span>
                    <div>
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-sm text-primary">{d.role}</div>
                    </div>
                  </div>
                  {d.bio && (
                    <p className="mt-3 text-sm text-muted-foreground">{d.bio}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Visit / contact */}
      <section
        id="contact"
        className="mx-auto max-w-5xl scroll-mt-20 px-5 py-14"
      >
        <h2 className="text-center text-2xl font-bold tracking-tight">
          {t("contactTitle")}
        </h2>
        <div className="mt-8 grid items-stretch gap-4 lg:grid-cols-2">
          {/* Hours + contact details */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border p-5">
              <div className="flex items-center gap-2 font-semibold">
                <Clock className="size-4 text-primary" aria-hidden />
                {t("hoursTitle")}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{hours}</p>
            </div>
            {contact && (contact.phone || contact.email || contact.address) && (
              <div className="space-y-2 rounded-2xl border border-border p-5 text-sm">
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                    className="flex items-center gap-2 hover:text-primary"
                  >
                    <Phone className="size-4 text-primary" aria-hidden />
                    {contact.phone}
                  </a>
                )}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-2 hover:text-primary"
                  >
                    <Mail className="size-4 text-primary" aria-hidden />
                    {contact.email}
                  </a>
                )}
                {contact.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4 text-primary" aria-hidden />
                    {contact.address}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Map */}
          {mapEmbedSrc && (
            <div className="flex min-h-64 flex-col gap-2">
              <iframe
                title={t("mapTitle")}
                src={mapEmbedSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full flex-1 rounded-2xl border border-border"
              />
              {mapLink && (
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t("directions")} →
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm">
          <span className="text-muted-foreground">{branding.name}</span>
          <div className="flex items-center gap-4">
            <Link href="/help" className="text-primary hover:underline">
              {th("title")}
            </Link>
            <Link href="/login" className="text-primary hover:underline">
              {t("logIn")}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
