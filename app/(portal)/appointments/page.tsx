import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getSessionUser } from "@auth";
import {
  getMyAppointments,
  type MyAppointment,
} from "@modules/appointments/server/booking";
import { getClinicConfig } from "@/config/clinic";
import { Button } from "@ui/primitives/button";
import { CancelButton } from "./cancel-button";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-muted text-muted-foreground line-through",
};

/**
 * Patient "My appointments" page — view upcoming + past, cancel within the
 * clinic's cancellation window. Login required.
 */
export default async function AppointmentsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const t = await getTranslations("appointments");
  const ts = await getTranslations("status");
  const locale = await getLocale();
  const config = getClinicConfig();
  const appts = await getMyAppointments();

  const now = Date.now();
  const windowMs = config.bookingRules.cancellationWindowHours * 3_600_000;

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: config.locale.timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  const isUpcoming = (a: MyAppointment) =>
    new Date(a.startIso).getTime() >= now && a.status !== "cancelled";
  const canCancel = (a: MyAppointment) =>
    (a.status === "pending" || a.status === "confirmed") &&
    new Date(a.startIso).getTime() - now >= windowMs;

  const upcoming = appts.filter(isUpcoming);
  const past = appts.filter((a) => !isUpcoming(a));

  const Row = ({ a }: { a: MyAppointment }) => (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
      <div className="space-y-0.5 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">{a.serviceName}</span>
          <span
            className={`rounded-md px-2 py-0.5 text-xs ${STATUS_STYLES[a.status] ?? ""}`}
          >
            {ts(a.status)}
          </span>
        </div>
        <div className="text-muted-foreground">{fmt(a.startIso)}</div>
      </div>
      {canCancel(a) && <CancelButton id={a.id} />}
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-primary">
        {t("title")}
      </h1>

      {appts.length === 0 && (
        <div className="space-y-4 rounded-xl border border-border p-6 text-center">
          <p className="text-muted-foreground">{t("empty")}</p>
          <Link href="/portal">
            <Button size="lg">{t("bookOne")}</Button>
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("upcoming")}
          </h2>
          {upcoming.map((a) => (
            <Row key={a.id} a={a} />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("past")}
          </h2>
          {past.map((a) => (
            <Row key={a.id} a={a} />
          ))}
        </section>
      )}
    </div>
  );
}
