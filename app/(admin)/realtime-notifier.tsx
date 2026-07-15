"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAppointmentRealtime } from "@modules/appointments/components/use-appointment-realtime";

/**
 * Realtime new-appointment alerts for staff. Subscribes to Postgres INSERTs on
 * `appointments` (gated by the staff RLS policy) and shows a toast + refreshes
 * the dashboard so new bookings appear live.
 */
export function RealtimeNotifier() {
  const t = useTranslations("realtime");

  useAppointmentRealtime("appointments-inserts", "INSERT", (row) => {
    toast(t("newAppointment"), { description: row?.service_name || undefined });
  });

  return null;
}
