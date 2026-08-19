"use client";

import { RescheduleControl } from "@modules/appointments/components/reschedule-control";
import { rescheduleAppointment } from "@modules/appointments";

/** Staff inline reschedule control for one appointment (wider slot grid). */
export function AdminRescheduleControl({
  appointmentId,
  serviceId,
}: {
  appointmentId: string;
  serviceId: string;
}) {
  return (
    <RescheduleControl
      serviceId={serviceId}
      columns={5}
      triggerAlign="start"
      onConfirm={async (startIso) =>
        (await rescheduleAppointment(appointmentId, startIso)).ok
      }
    />
  );
}
