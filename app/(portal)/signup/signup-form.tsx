"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormRenderer, type FormSchema } from "@form-engine";
import { signUp } from "@auth/actions";

const SCHEMA: FormSchema = [
  { name: "fullName", label: "Full name", type: "text", required: true },
  { name: "phone", label: "Phone number", type: "phone", required: true },
  { name: "email", label: "Email", type: "email", required: true },
  {
    name: "password",
    label: "Password",
    type: "password",
    required: true,
    description: "At least 6 characters.",
  },
];

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  if (info) {
    return <p className="text-sm font-medium text-primary">{info}</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <FormRenderer
        schema={SCHEMA}
        submitLabel="Create account"
        onSubmit={async (v) => {
          setError(null);
          const res = await signUp({
            fullName: String(v.fullName),
            phone: String(v.phone),
            email: String(v.email),
            password: String(v.password),
          });
          if (!res.ok) {
            setError(res.error ?? "Sign up failed");
            return;
          }
          if (res.needsConfirmation) {
            setInfo(
              "Account created. Check your email to confirm, then log in."
            );
            return;
          }
          router.push("/portal");
          router.refresh();
        }}
      />
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
