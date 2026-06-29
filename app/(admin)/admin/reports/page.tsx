import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser, isStaff } from "@auth";
import { getReportData } from "@modules/appointments/server/reports";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@ui/primitives/card";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-muted text-muted-foreground line-through",
};
const STATUS_ORDER = ["pending", "confirmed", "completed", "cancelled"];

/** Admin reports — appointment analytics. Staff only. */
export default async function ReportsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!isStaff(user.role)) redirect("/admin");

  const t = await getTranslations("reports");
  const ts = await getTranslations("status");
  const data = await getReportData();

  const maxDaily = Math.max(1, ...data.daily.map((d) => d.count));
  const maxService = Math.max(1, ...data.byService.map((s) => s.count));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      {data.total === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noData")}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <div className="text-3xl font-bold text-primary">
                  {data.total}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("total")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("byStatus")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {STATUS_ORDER.map((s) => (
                  <span
                    key={s}
                    className={`rounded-md px-2 py-1 text-xs ${STATUS_STYLES[s]}`}
                  >
                    {ts(s)}: {data.byStatus[s] ?? 0}
                  </span>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("last14")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-32 items-end gap-1">
                {data.daily.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.count}`}
                    className="flex-1 rounded-t bg-primary/80 transition-colors hover:bg-primary"
                    style={{
                      height: `${(d.count / maxDaily) * 100}%`,
                      minHeight: "2px",
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{data.daily[0]?.date.slice(5)}</span>
                <span>{data.daily[data.daily.length - 1]?.date.slice(5)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("byService")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.byService.map((s) => (
                <div key={s.service} className="space-y-1">
                  <div className="flex justify-between gap-4 text-sm">
                    <span>{s.service}</span>
                    <span className="text-muted-foreground">{s.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(s.count / maxService) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
