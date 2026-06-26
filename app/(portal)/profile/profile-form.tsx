"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormRenderer, type FormSchema } from "@form-engine";
import {
  updateMyProfile,
  type MyProfile,
} from "@modules/patients/server/profile";

export function ProfileForm({ profile }: { profile: MyProfile }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [status, setStatus] = React.useState<"idle" | "saved" | "error">(
    "idle"
  );

  const schema: FormSchema = [
    { name: "fullName", label: t("fullName"), type: "text", required: true },
    { name: "phone", label: t("phone"), type: "phone", required: true },
    { name: "email", label: t("email"), type: "email", required: false },
    {
      name: "dateOfBirth",
      label: t("dateOfBirth"),
      type: "date",
      required: false,
    },
  ];

  return (
    <div className="space-y-3">
      {status === "saved" && (
        <p className="text-sm font-medium text-primary">{t("saved")}</p>
      )}
      {status === "error" && (
        <p className="text-sm font-medium text-destructive">
          {t("saveFailed")}
        </p>
      )}
      <FormRenderer
        schema={schema}
        submitLabel={t("save")}
        defaultValues={profile}
        onSubmit={async (v) => {
          setStatus("idle");
          const res = await updateMyProfile(v);
          if (res.ok) {
            setStatus("saved");
            router.refresh();
          } else {
            setStatus("error");
          }
        }}
      />
    </div>
  );
}
