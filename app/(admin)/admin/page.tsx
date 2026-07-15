import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getClinicConfig } from "@/config/clinic";
import { isModuleEnabled } from "@config-engine";
import { formatDateTime } from "@/lib/format";
import { getSessionUser, isStaff } from "@auth";
import { signOutAndRedirect } from "@auth/actions";
import {
  getAppointmentsPage,
  getDashboardStats,
  updateAppointmentStatus,
} from "@modules/appointments/server/admin";
import { APPOINTMENTS_PAGE_SIZE } from "@modules/appointments/server/core";
import { getTelehealthState } from "@modules/telehealth";
import { AdminRescheduleControl } from "./reschedule-control";
import { StatusBadge } from "@ui/patterns/status-badge";
import { Pagination } from "@ui/patterns/pagination";
import { Skeleton } from "@ui/primitives/skeleton";
import { Button } from "@ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ui/primitives/card";

async function changeStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  await updateAppointmentStatus(id, status);
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const t = await getTranslations("admin");
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  if (!isStaff(user.role)) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
        <h1 className="text-xl font-semibold">{t("notAuthorized")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("notAuthorizedBody", { email: user.email })}
        </p>
        <form action={signOutAndRedirect.bind(null, "/admin/login")}>
          <Button type="submit" variant="outline" size="sm">
            {t("signOut")}
          </Button>
        </form>
      </div>
    );
  }

  const config = getClinicConfig();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

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
          <form action={signOutAndRedirect.bind(null, "/admin/login")}>
            <Button type="submit" variant="outline" size="sm">
              {t("signOut")}
            </Button>
          </form>
        </div>
      </header>

      {/* Static shell above renders immediately; the SQL-backed stats + list
          stream in when ready. `page` in the key resets the boundary on paging. */}
      <Suspense key={page} fallback={<DashboardSkeleton />}>
        <DashboardBody page={page} />
      </Suspense>
    </div>
  );
}

async function DashboardBody({ page }: { page: number }) {
  const t = await getTranslations("admin");
  const ts = await getTranslations("status");
  const tt = await getTranslations("telehealth");
  const tp = await getTranslations("pagination");
  const config = getClinicConfig();
  const locale = await getLocale();
  const telehealthOn = isModuleEnabled(config, "telehealth");

  const [stats, appointments] = await Promise.all([
    getDashboardStats(),
    getAppointmentsPage({
      limit: APPOINTMENTS_PAGE_SIZE,
      offset: (page - 1) * APPOINTMENTS_PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(stats.total / APPOINTMENTS_PAGE_SIZE));

  const fmt = (iso: string) =>
    formatDateTime(iso, locale, config.locale.timezone);
  const hrefForPage = (p: number) => (p > 1 ? `/admin?page=${p}` : "/admin");
  const serviceById = new Map(config.services.map((s) => [s.id, s] as const));

  const statCards = [
    { label: t("statToday"), value: stats.today },
    { label: t("statPending"), value: stats.pending },
    { label: t("statUpcoming"), value: stats.upcoming },
  ];

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {statCards.map((s) => (
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
            {t("allAppointments", { count: stats.total })}
          </CardTitle>
          <CardDescription>{t("newestFirst")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.total === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("noAppointments")}{" "}
              <Link href="/portal" className="underline">
                {t("tryBooking")}
              </Link>
              .
            </p>
          )}
          {appointments.map((a) => {
            const tele = getTelehealthState({
              enabled: telehealthOn,
              service: serviceById.get(a.serviceId),
              status: a.status,
              startIso: a.startIso,
              appointmentId: a.id,
              clinicSlug: config.slug,
            });
            return (
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
                    {tele.visible &&
                      (tele.joinable ? (
                        <a
                          href={tele.url}
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
                      ))}
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
            );
          })}

          <Pagination
            page={page}
            totalPages={totalPages}
            hrefForPage={hrefForPage}
            prevLabel={tp("prev")}
            nextLabel={tp("next")}
            summary={tp("page", { page, total: totalPages })}
          />
        </CardContent>
      </Card>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[68px]" />
        ))}
      </div>
      <div className="space-y-3 rounded-xl border border-border p-4">
        <Skeleton className="h-5 w-40" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </>
  );
}
