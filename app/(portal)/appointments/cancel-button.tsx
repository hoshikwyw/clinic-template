"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cancelMyAppointment } from "@modules/appointments";
import { Button } from "@ui/primitives/button";

export function CancelButton({ id }: { id: string }) {
  const t = useTranslations("appointments");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="space-y-1 text-right">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await cancelMyAppointment(id);
            if (res.ok) {
              router.refresh();
            } else {
              setError(
                res.error === "window" ? t("cancelWindow") : t("cancelFailed")
              );
            }
          })
        }
      >
        {pending ? t("cancelling") : t("cancel")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
