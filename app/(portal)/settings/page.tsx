import { getTranslations } from "next-intl/server";
import { getClinicConfig } from "@/config/clinic";
import { SettingsPanel } from "@ui";

/**
 * Settings page — language, text size, high contrast. Guest-accessible (these
 * are device preferences, no login needed).
 */
export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const config = getClinicConfig();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-primary">
        {t("title")}
      </h1>
      <SettingsPanel languages={config.locale.languages} />
    </div>
  );
}
