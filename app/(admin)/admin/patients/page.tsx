import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser, isStaff } from "@auth";
import { getPatientsList } from "@modules/patients/server/admin";
import { Button } from "@ui/primitives/button";
import { Input } from "@ui/primitives/input";

/**
 * Admin patients directory — searchable list, links to each patient's record.
 * Staff only.
 */
export default async function AdminPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!isStaff(user.role)) redirect("/admin");

  const { q } = await searchParams;
  const t = await getTranslations("adminPatients");
  const list = await getPatientsList(q);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      <form action="/admin/patients" className="flex gap-2">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline">
          {t("search")}
        </Button>
      </form>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <div className="space-y-2">
          {list.map((p) => (
            <Link
              key={p.id}
              href={`/admin/patients/${p.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 transition-colors hover:border-primary"
            >
              <div>
                <div className="font-medium">{p.fullName}</div>
                <div className="text-sm text-muted-foreground">
                  {p.phone}
                  {p.email ? ` · ${p.email}` : ""}
                </div>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("appts", { count: p.appointmentCount })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
