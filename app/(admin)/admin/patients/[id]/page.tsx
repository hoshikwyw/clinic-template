import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getSessionUser, isStaff } from "@auth";
import { getPatientDetail } from "@modules/patients";
import { getClinicConfig } from "@/config/clinic";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@ui/patterns/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@ui/primitives/card";

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

  const fmt = (iso: string) => formatDateTime(iso, locale, config.locale.timezone);

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
                <StatusBadge status={a.status} label={ts(a.status)} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
