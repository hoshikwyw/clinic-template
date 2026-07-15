import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser, isStaff } from "@auth";
import {
  getPatientsList,
  PATIENTS_PAGE_SIZE,
} from "@modules/patients/server/admin";
import { Button } from "@ui/primitives/button";
import { Input } from "@ui/primitives/input";
import { Pagination } from "@ui/patterns/pagination";

/**
 * Admin patients directory — searchable, paginated list linking to each
 * patient's record. Staff only.
 */
export default async function AdminPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!isStaff(user.role)) redirect("/admin");

  const { q, page: pageParam } = await searchParams;
  const t = await getTranslations("adminPatients");
  const tp = await getTranslations("pagination");

  const page = Math.max(1, Number(pageParam) || 1);
  const { items, total } = await getPatientsList({
    search: q,
    limit: PATIENTS_PAGE_SIZE,
    offset: (page - 1) * PATIENTS_PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PATIENTS_PAGE_SIZE));

  const hrefForPage = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/patients?${qs}` : "/admin/patients";
  };

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

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((p) => (
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

          <Pagination
            page={page}
            totalPages={totalPages}
            hrefForPage={hrefForPage}
            prevLabel={tp("prev")}
            nextLabel={tp("next")}
            summary={tp("page", { page, total: totalPages })}
          />
        </>
      )}
    </div>
  );
}
