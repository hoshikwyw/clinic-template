import { redirect } from "next/navigation";
import { getSessionUser } from "@auth";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect("/portal");

  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Create account</h1>
        <p className="text-sm text-muted-foreground">
          Sign up to manage your appointments.
        </p>
      </header>
      <SignupForm />
    </div>
  );
}
