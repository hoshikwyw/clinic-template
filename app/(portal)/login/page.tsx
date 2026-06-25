import { redirect } from "next/navigation";
import { getSessionUser } from "@auth";
import { LoginForm } from "@auth/login-form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/portal");

  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Log in</h1>
        <p className="text-sm text-muted-foreground">
          Access your appointments.
        </p>
      </header>
      <LoginForm redirectTo="/portal" signupHref="/signup" />
    </div>
  );
}
