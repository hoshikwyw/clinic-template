import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@auth";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect("/portal");

  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("signupTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("signupSubtitle")}</p>
      </header>
      <SignupForm />
    </div>
  );
}
