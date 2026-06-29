"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Realtime new-appointment alerts for staff. Subscribes to Postgres INSERTs on
 * `appointments` (Supabase Realtime, gated by the staff RLS policy) and shows a
 * toast + refreshes the dashboard so new bookings appear live.
 */
export function RealtimeNotifier() {
  const router = useRouter();
  const t = useTranslations("realtime");

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("appointments-inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments" },
        (payload) => {
          const serviceName =
            (payload.new as { service_name?: string } | null)?.service_name ??
            "";
          toast(t("newAppointment"), {
            description: serviceName || undefined,
          });
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
