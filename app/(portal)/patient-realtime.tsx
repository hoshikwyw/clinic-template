"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Live updates for the logged-in patient's own appointments. Subscribes to
 * Postgres UPDATEs on `appointments` (RLS `appointments_self_select` limits
 * events to the patient's own rows). Toasts when staff confirm/complete; always
 * refreshes so the list stays current. Self-initiated changes (reschedule →
 * pending, cancel) don't toast — the patient already saw that action.
 */
export function PatientRealtimeNotifier() {
  const router = useRouter();
  const t = useTranslations("realtime");

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("my-appointments")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "appointments" },
        (payload) => {
          const row = payload.new as {
            status?: string;
            service_name?: string;
          } | null;
          const description = row?.service_name || undefined;
          if (row?.status === "confirmed") {
            toast.success(t("confirmed"), { description });
          } else if (row?.status === "completed") {
            toast(t("completed"), { description });
          }
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, t]);

  return null;
}
