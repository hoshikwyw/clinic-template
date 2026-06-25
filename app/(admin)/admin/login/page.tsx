import { redirect } from "next/navigation";
import { getSessionUser, isStaff } from "@auth";
import { LoginForm } from "@auth/login-form";

export default async function AdminLoginPage() {
  const user = await getSessionUser();
  if (user && isStaff(user.role)) redirect("/admin");

  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Staff login</h1>
        <p className="text-sm text-muted-foreground">
          For clinic staff and administrators.
        </p>
      </header>
      <LoginForm redirectTo="/admin" signupHref={null} />
    </div>
  );
}
