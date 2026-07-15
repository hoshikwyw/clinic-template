import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getSessionUser } from "@auth";
import {
  getMyAppointments,
  type MyAppointment,
} from "@modules/appointments/server/booking";
import { getClinicConfig } from "@/config/clinic";
import { isModuleEnabled } from "@config-engine";
import { getTelehealthState } from "@modules/telehealth";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@ui/patterns/status-badge";
import { Button } from "@ui/primitives/button";
import { CancelButton } from "./cancel-button";
import { RescheduleControl } from "./reschedule-control";

/**
 * Patient "My appointments" page — view upcoming + past, cancel within the
 * clinic's cancellation window. Login required.
 */
export default async function AppointmentsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const t = await getTranslations("appointments");
  const ts = await getTranslations("status");
  const tt = await getTranslations("telehealth");
  const locale = await getLocale();
  const config = getClinicConfig();
  const appts = await getMyAppointments();
  const telehealthOn = isModuleEnabled(config, "telehealth");

  // Server Component: renders once per request, never re-rendered — reading the
  // clock here is deterministic (the purity rule targets Client Components).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const windowMs = config.bookingRules.cancellationWindowHours * 3_600_000;

  const fmt = (iso: string) => formatDateTime(iso, locale, config.locale.timezone);

  const isUpcoming = (a: MyAppointment) =>
    new Date(a.startIso).getTime() >= now && a.status !== "cancelled";
  const canCancel = (a: MyAppointment) =>
    (a.status === "pending" || a.status === "confirmed") &&
    new Date(a.startIso).getTime() - now >= windowMs;

  const upcoming = appts.filter(isUpcoming);
  const past = appts.filter((a) => !isUpcoming(a));

  const Row = ({ a }: { a: MyAppointment }) => {
    const tele = getTelehealthState({
      enabled: telehealthOn,
      service: config.services.find((s) => s.id === a.serviceId),
      status: a.status,
      startIso: a.startIso,
      appointmentId: a.id,
      clinicSlug: config.slug,
      now,
    });

    return (
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{a.serviceName}</span>
              <StatusBadge status={a.status} label={ts(a.status)} />
            </div>
            <div className="text-muted-foreground">{fmt(a.startIso)}</div>
          </div>
        </div>

        {tele.visible && (
          <div className="mt-3">
            {tele.joinable ? (
              <a
                href={tele.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                🎥 {tt("join")}
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">
                {tt("video")} · {tt("opensSoon")}
              </p>
            )}
          </div>
        )}

        {canCancel(a) && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <RescheduleControl appointmentId={a.id} serviceId={a.serviceId} />
            <div className="flex justify-end">
              <CancelButton id={a.id} />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-primary">
        {t("title")}
      </h1>

      {appts.length === 0 && (
        <div className="space-y-4 rounded-xl border border-border p-6 text-center">
          <p className="text-muted-foreground">{t("empty")}</p>
          <Link href="/book">
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
