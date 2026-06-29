import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { getClinicConfig } from "@/config/clinic";
import { getSessionUser } from "@auth";
import { signOut } from "@auth/actions";
import { getMyAppointments } from "@modules/appointments/server/booking";
import { Button } from "@ui/primitives/button";
import { Card, CardContent } from "@ui/primitives/card";

async function handleSignOut() {
  "use server";
  await signOut();
  redirect("/portal");
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-primary/10 text-primary",
  completed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  cancelled: "bg-muted text-muted-foreground line-through",
};

/**
 * Patient home — an overview, not a task. Shows the next appointment at a glance,
 * a prominent Book call-to-action, and a services overview. Booking itself lives
 * on its own focused page (/book).
 */
export default async function PortalHome() {
  const config = getClinicConfig();
  const t = await getTranslations("portal");
  const ts = await getTranslations("status");
  const tb = await getTranslations("booking");
  const th = await getTranslations("help");
  const locale = await getLocale();
  const user = await getSessionUser();
  const appointments = user ? await getMyAppointments() : [];

  const now = Date.now();
  const next =
    appointments
      .filter(
        (a) => new Date(a.startIso).getTime() >= now && a.status !== "cancelled"
      )
      .sort(
        (a, b) =>
          new Date(a.startIso).getTime() - new Date(b.startIso).getTime()
      )[0] ?? null;

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: config.locale.timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  const money = (n?: number) =>
    n ? `${n.toLocaleString()} ${config.locale.currency}` : "";

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            {config.branding.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user
              ? t("greeting", { name: user.fullName ?? user.email })
              : t("welcome")}
          </p>
        </div>
        {user ? (
          <form action={handleSignOut}>
            <Button type="submit" variant="outline" size="sm">
              {t("signOut")}
            </Button>
          </form>
        ) : (
          <Link href="/login">
            <Button variant="outline" size="sm">
              {t("logIn")}
            </Button>
          </Link>
        )}
      </header>

      {/* Next appointment at a glance (logged-in) */}
      {user && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("nextAppt")}
              </p>
              <Link
                href="/appointments"
                className="text-xs text-primary hover:underline"
              >
                {t("viewAll")}
              </Link>
            </div>
            {next ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">{next.serviceName}</div>
                  <div className="text-muted-foreground">
                    {fmt(next.startIso)}
                  </div>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs ${STATUS_STYLES[next.status] ?? ""}`}
                >
                  {ts(next.status)}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("noUpcoming")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Primary action: book */}
      <Link href="/book" className="block">
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-primary px-5 py-4 text-primary-foreground transition-opacity hover:opacity-95">
          <div>
            <div className="text-lg font-semibold">{t("book")}</div>
            <div className="text-sm opacity-90">{t("bookCtaSub")}</div>
          </div>
          <CalendarPlus className="size-7 shrink-0" aria-hidden />
        </div>
      </Link>

      {/* Services overview */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("ourServices")}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {config.services.map((s) => (
            <Link
              key={s.id}
              href={`/book?service=${s.id}`}
              className="rounded-xl border border-border p-4 transition-colors hover:border-primary"
            >
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-muted-foreground">
                {s.durationMinutes} {tb("minUnit")}
                {s.price ? ` · ${money(s.price)}` : ""}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Help */}
      <Link
        href="/help"
        className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 transition-colors hover:border-primary"
      >
        <div>
          <div className="font-medium">{th("needHelp")}</div>
          <div className="text-sm text-muted-foreground">
            {th("needHelpSub")}
          </div>
        </div>
        <span aria-hidden className="text-primary">
          →
        </span>
      </Link>
    </div>
  );
}
