"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormRenderer, type FormSchema } from "@form-engine";
import { signIn } from "./actions";

const SCHEMA: FormSchema = [
  { name: "email", label: "Email", type: "email", required: true },
  { name: "password", label: "Password", type: "password", required: true },
];

export interface LoginFormProps {
  /** where to go after a successful login */
  redirectTo?: string;
  /** signup link to show, or null to hide (e.g. staff login) */
  signupHref?: string | null;
}

export function LoginForm({
  redirectTo = "/portal",
  signupHref = "/signup",
}: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <FormRenderer
        schema={SCHEMA}
        submitLabel="Log in"
        onSubmit={async (v) => {
          setError(null);
          const res = await signIn({
            email: String(v.email),
            password: String(v.password),
          });
          if (res.ok) {
            router.push(redirectTo);
            router.refresh();
          } else {
            setError(res.error ?? "Login failed");
          }
        }}
      />
      {signupHref && (
        <p className="text-sm text-muted-foreground">
          No account?{" "}
          <Link href={signupHref} className="font-medium underline">
            Sign up
          </Link>
        </p>
      )}
    </div>
  );
}
