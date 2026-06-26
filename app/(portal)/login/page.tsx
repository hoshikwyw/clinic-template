import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@auth";
import { LoginForm } from "@auth/login-form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/portal");

  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("loginTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("loginSubtitle")}</p>
      </header>
      <LoginForm redirectTo="/portal" signupHref="/signup" />
    </div>
  );
}
