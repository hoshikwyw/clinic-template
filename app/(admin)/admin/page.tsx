import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getClinicConfig } from "@/config/clinic";
import { isModuleEnabled } from "@config-engine";
import { getSessionUser, isStaff } from "@auth";
import { signOut } from "@auth/actions";
import {
  getAllAppointments,
  updateAppointmentStatus,
} from "@modules/appointments/server/admin";
import { meetingUrl, isJoinable } from "@modules/telehealth";
import { AdminRescheduleControl } from "./reschedule-control";
import { Button } from "@ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ui/primitives/card";

async function handleSignOut() {
  "use server";
  await signOut();
  redirect("/admin/login");
}

async function changeStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  await updateAppointmentStatus(id, status);
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const styles: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    confirmed: "bg-primary/10 text-primary",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-muted text-muted-foreground line-through",
  };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs ${styles[status] ?? ""}`}>
      {label}
    </span>
  );
}

export default async function AdminHome() {
  const t = await getTranslations("admin");
  const ts = await getTranslations("status");
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  if (!isStaff(user.role)) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
        <h1 className="text-xl font-semibold">{t("notAuthorized")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("notAuthorizedBody", { email: user.email })}
        </p>
        <form action={handleSignOut}>
          <Button type="submit" variant="outline" size="sm">
            {t("signOut")}
          </Button>
        </form>
      </div>
    );
  }

  const tt = await getTranslations("telehealth");
  const config = getClinicConfig();
  const appointments = await getAllAppointments();
  const locale = await getLocale();
  const telehealthOn = isModuleEnabled(config, "telehealth");

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: config.locale.timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  // Stats (clinic timezone). "Today" = same calendar day; excludes cancelled.
  const now = Date.now();
  const dateInTz = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: config.locale.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  const todayStr = dateInTz(new Date().toISOString());
  const active = appointments.filter((a) => a.status !== "cancelled");
  const stats = [
    {
      label: t("statToday"),
      value: active.filter((a) => dateInTz(a.startIso) === todayStr).length,
    },
    {
      label: t("statPending"),
      value: appointments.filter((a) => a.status === "pending").length,
    },
    {
      label: t("statUpcoming"),
      value: active.filter((a) => new Date(a.startIso).getTime() >= now).length,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("signedInAs", {
              clinic: config.branding.name,
              email: user.email,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/export"
            className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t("exportCsv")}
          </a>
          <form action={handleSignOut}>
            <Button type="submit" variant="outline" size="sm">
              {t("signOut")}
            </Button>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("allAppointments", { count: appointments.length })}
          </CardTitle>
          <CardDescription>{t("newestFirst")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {appointments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("noAppointments")}{" "}
              <Link href="/portal" className="underline">
                {t("tryBooking")}
              </Link>
              .
            </p>
          )}
          {appointments.map((a) => (
            <div
              key={a.id}
              className="space-y-3 rounded-xl border border-border p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5 text-sm">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/patients/${a.patientId}`}
                    className="font-medium hover:underline"
                  >
                    {a.patientName}
                  </Link>
                  <StatusBadge status={a.status} label={ts(a.status)} />
                </div>
                <div className="text-muted-foreground">
                  {a.serviceName} · {fmt(a.startIso)}
                </div>
                <div className="text-muted-foreground">{a.patientPhone}</div>
                {(() => {
                  const service = config.services.find(
                    (s) => s.id === a.serviceId
                  );
                  const showTele =
                    telehealthOn &&
                    Boolean(service?.telehealth) &&
                    a.status !== "cancelled" &&
                    a.status !== "completed";
                  if (!showTele) return null;
                  return isJoinable(a.startIso, service!.durationMinutes, now) ? (
                    <a
                      href={meetingUrl({
                        appointmentId: a.id,
                        clinicSlug: config.slug,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      🎥 {tt("join")}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      🎥 {tt("video")}
                    </span>
                  );
                })()}
              </div>
              <form action={changeStatus} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={a.id} />
                <Button
                  type="submit"
                  name="status"
                  value="confirmed"
                  size="sm"
                  disabled={a.status === "confirmed"}
                >
                  {t("confirm")}
                </Button>
                <Button
                  type="submit"
                  name="status"
                  value="completed"
                  size="sm"
                  variant="outline"
                  disabled={a.status === "completed"}
                >
                  {t("complete")}
                </Button>
                <Button
                  type="submit"
                  name="status"
                  value="cancelled"
                  size="sm"
                  variant="ghost"
                  disabled={a.status === "cancelled"}
                >
                  {t("cancel")}
                </Button>
              </form>
              </div>
              {(a.status === "pending" || a.status === "confirmed") && (
                <div className="border-t border-border pt-3">
                  <AdminRescheduleControl
                    appointmentId={a.id}
                    serviceId={a.serviceId}
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
