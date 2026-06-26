"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormRenderer, type FormSchema } from "@form-engine";
import { signIn } from "./actions";

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
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  const schema: FormSchema = [
    { name: "email", label: t("email"), type: "email", required: true },
    { name: "password", label: t("password"), type: "password", required: true },
  ];

  return (
    <div className="space-y-4">
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <FormRenderer
        schema={schema}
        submitLabel={t("logIn")}
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
            setError(res.error ?? t("loginFailed"));
          }
        }}
      />
      {signupHref && (
        <p className="text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href={signupHref} className="font-medium underline">
            {t("signUp")}
          </Link>
        </p>
      )}
    </div>
  );
}
