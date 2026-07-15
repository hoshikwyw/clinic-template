"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAppointmentRealtime } from "@modules/appointments/components/use-appointment-realtime";

/**
 * Live updates for the logged-in patient's own appointments. Subscribes to
 * Postgres UPDATEs on `appointments` (RLS limits events to the patient's own
 * rows). Toasts when staff confirm/complete; always refreshes. Self-initiated
 * changes (reschedule → pending, cancel) don't toast — the patient saw those.
 */
export function PatientRealtimeNotifier() {
  const t = useTranslations("realtime");

  useAppointmentRealtime("my-appointments", "UPDATE", (row) => {
    const description = row?.service_name || undefined;
    if (row?.status === "confirmed") {
      toast.success(t("confirmed"), { description });
    } else if (row?.status === "completed") {
      toast(t("completed"), { description });
    }
  });

  return null;
}
