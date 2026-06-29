import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getSessionUser, isStaff } from "@auth";
import { getPatientDetail } from "@modules/patients/server/admin";
import { getClinicConfig } from "@/config/clinic";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@ui/primitives/card";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-primary/10 text-primary",
  completed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  cancelled: "bg-muted text-muted-foreground line-through",
};

function renderValue(value: unknown): string {
  if (value === true) return "✓";
  if (value === false || value === null || value === "") return "—";
  return String(value);
}

/** Admin patient record — contact, intake answers, appointment history. */
export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!isStaff(user.role)) redirect("/admin");

  const { id } = await params;
  const t = await getTranslations("adminPatients");
  const ts = await getTranslations("status");
  const locale = await getLocale();
  const config = getClinicConfig();
  const p = await getPatientDetail(id);
  if (!p) notFound();

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: config.locale.timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  const intakeEntries = p.intake ? Object.entries(p.intake) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/admin/patients"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {t("back")}
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{p.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          {t("account")}: {p.hasAccount ? t("hasAccount") : t("guest")}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("contact")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>{p.phone}</div>
          {p.email && <div className="text-muted-foreground">{p.email}</div>}
          {p.dateOfBirth && (
            <div className="text-muted-foreground">
              {t("dob")}: {p.dateOfBirth}
            </div>
          )}
        </CardContent>
      </Card>

      {intakeEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("intake")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {intakeEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{key}</span>
                <span className="text-right font-medium">
                  {renderValue(value)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("history")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {p.appointments.length === 0 ? (
            <p className="text-muted-foreground">{t("noHistory")}</p>
          ) : (
            p.appointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-4">
                <span>
                  <span className="font-medium">{a.serviceName}</span>
                  <span className="block text-muted-foreground">
                    {fmt(a.startIso)}
                  </span>
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs ${STATUS_STYLES[a.status] ?? ""}`}
                >
                  {ts(a.status)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
