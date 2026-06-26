import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser, isStaff } from "@auth";
import { getClinicConfig } from "@/config/clinic";
import { SettingsPanel } from "@ui";

/** Admin settings — language, text size, high contrast. Staff only. */
export default async function AdminSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!isStaff(user.role)) redirect("/admin");

  const t = await getTranslations("settings");
  const config = getClinicConfig();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <SettingsPanel languages={config.locale.languages} />
    </div>
  );
}
