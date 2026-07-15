"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type AppointmentRow = { status?: string; service_name?: string } | null;

/**
 * Subscribe to Supabase Realtime changes on the `appointments` table and refresh
 * the current route on each event. Shared by the staff (INSERT) and patient
 * (UPDATE) notifiers, which differ only in event, channel, and toast handling.
 *
 * The handler is kept in a ref so passing a fresh closure each render doesn't
 * tear down and re-subscribe the channel.
 */
export function useAppointmentRealtime(
  channel: string,
  event: "INSERT" | "UPDATE",
  onRow: (row: AppointmentRow) => void
) {
  const router = useRouter();

  // Keep the latest handler in a ref (updated in an effect, not during render)
  // so a fresh closure each render doesn't re-subscribe the channel.
  const handlerRef = React.useRef(onRow);
  React.useEffect(() => {
    handlerRef.current = onRow;
  });

  React.useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(channel)
      .on(
        "postgres_changes",
        { event, schema: "public", table: "appointments" },
        (payload) => {
          handlerRef.current(payload.new as AppointmentRow);
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [router, channel, event]);
}
