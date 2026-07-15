"use client";

import { RescheduleControl as RescheduleControlBase } from "@modules/appointments/components/reschedule-control";
import { rescheduleMyAppointment } from "@modules/appointments/server/booking";

/** Patient inline reschedule control for one of their own appointments. */
export function RescheduleControl({
  appointmentId,
  serviceId,
}: {
  appointmentId: string;
  serviceId: string;
}) {
  return (
    <RescheduleControlBase
      serviceId={serviceId}
      columns={4}
      triggerAlign="end"
      onConfirm={async (startIso) =>
        (await rescheduleMyAppointment({ appointmentId, startIso })).ok
      }
    />
  );
}
