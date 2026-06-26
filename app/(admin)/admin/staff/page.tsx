import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser, isAdmin } from "@auth";
import { listStaff } from "@modules/staff/server/admin";
import { StaffManager } from "./staff-manager";

/**
 * Admin staff & roles page — view the team and assign roles. ADMIN ONLY
 * (assigning roles is privileged). Non-admins are sent back to the dashboard.
 */
export default async function AdminStaffPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!isAdmin(user.role)) redirect("/admin");

  const t = await getTranslations("adminStaff");
  const staff = await listStaff();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <StaffManager staff={staff} currentUserId={user.id} />
    </div>
  );
}
