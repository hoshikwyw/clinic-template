"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  getAvailableSlots,
  rescheduleMyAppointment,
} from "@modules/appointments/server/booking";
import type { DaySlots, Slot } from "@modules/scheduling";
import { Button } from "@ui/primitives/button";

/**
 * Inline "reschedule" control for one appointment: toggles a slot picker (same
 * day/time UI as the booking wizard) and moves the appointment to a new slot.
 */
export function RescheduleControl({
  appointmentId,
  serviceId,
}: {
  appointmentId: string;
  serviceId: string;
}) {
  const t = useTranslations("appointments");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [days, setDays] = React.useState<DaySlots[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [date, setDate] = React.useState<string | null>(null);
  const [slot, setSlot] = React.useState<Slot | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!days) {
      setLoading(true);
      try {
        const d = await getAvailableSlots(serviceId);
        setDays(d);
        setDate(d[0]?.date ?? null);
      } finally {
        setLoading(false);
      }
    }
  }

  async function confirm() {
    if (!slot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await rescheduleMyAppointment({
        appointmentId,
        startIso: slot.startIso,
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(t("rescheduleFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const daySlots = days?.find((d) => d.date === date)?.slots ?? [];

  return (
    <div className="space-y-3">
      <div className="text-right">
        <Button variant="outline" size="sm" onClick={toggle}>
          {t("reschedule")}
        </Button>
      </div>

      {open && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-sm font-medium">{t("chooseNewTime")}</p>

          {loading && (
            <p className="text-sm text-muted-foreground">{t("finding")}</p>
          )}
          {!loading && days && days.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noTimes")}</p>
          )}
          {!loading && days && days.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {days.map((d) => (
                  <button
                    key={d.date}
                    onClick={() => {
                      setDate(d.date);
                      setSlot(null);
                    }}
                    className={`min-h-9 rounded-full border px-3 text-sm ${
                      d.date === date
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {daySlots.map((s) => (
                  <button
                    key={s.startIso}
                    onClick={() => setSlot(s)}
                    className={`min-h-10 rounded-lg border text-sm ${
                      slot?.startIso === s.startIso
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!slot || submitting}
                  onClick={confirm}
                >
                  {submitting ? t("rescheduling") : t("confirmReschedule")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
