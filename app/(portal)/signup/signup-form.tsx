"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormRenderer, type FormSchema } from "@form-engine";
import { signUp } from "@auth/actions";

export function SignupForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const schema: FormSchema = [
    { name: "fullName", label: t("fullName"), type: "text", required: true },
    { name: "phone", label: t("phone"), type: "phone", required: true },
    { name: "email", label: t("email"), type: "email", required: true },
    {
      name: "password",
      label: t("password"),
      type: "password",
      required: true,
      description: t("passwordHint"),
    },
  ];

  if (info) {
    return <p className="text-sm font-medium text-primary">{info}</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <FormRenderer
        schema={schema}
        submitLabel={t("createAccount")}
        onSubmit={async (v) => {
          setError(null);
          const res = await signUp({
            fullName: String(v.fullName),
            phone: String(v.phone),
            email: String(v.email),
            password: String(v.password),
          });
          if (!res.ok) {
            setError(res.error ?? t("signupFailed"));
            return;
          }
          if (res.needsConfirmation) {
            setInfo(t("confirmEmailInfo"));
            return;
          }
          router.push("/portal");
          router.refresh();
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium underline">
          {t("logIn")}
        </Link>
      </p>
    </div>
  );
}
