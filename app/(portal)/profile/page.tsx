import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getMyProfile } from "@modules/patients/server/profile";
import { ProfileForm } from "./profile-form";

/**
 * Patient profile page — view + edit personal details. Login required.
 */
export default async function ProfilePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const t = await getTranslations("profile");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <ProfileForm profile={profile} />
    </div>
  );
}
