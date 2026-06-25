import type { ClinicConfig } from "@config-engine";

/**
 * Email templates for appointment notifications. Plain, accessible HTML.
 * Subject + body are built from the clinic config + appointment details.
 */

export interface AppointmentEmailData {
  patientName: string;
  serviceName: string;
  startIso: string;
}

function formatWhen(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function wrap(clinic: ClinicConfig, body: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
    <h2 style="color:#111">${clinic.branding.name}</h2>
    ${body}
    <p style="color:#666;font-size:12px;margin-top:24px">
      This is an automated message from ${clinic.branding.name}.
    </p>
  </div>`;
}

export function bookedEmail(clinic: ClinicConfig, d: AppointmentEmailData) {
  const when = formatWhen(d.startIso, clinic.locale.timezone);
  return {
    subject: `Appointment requested — ${clinic.branding.name}`,
    html: wrap(
      clinic,
      `<p>Hi ${d.patientName},</p>
       <p>We've received your request for <strong>${d.serviceName}</strong> on
       <strong>${when}</strong>.</p>
       <p>We'll contact you to confirm. Please keep your phone reachable.</p>`
    ),
  };
}

export function statusEmail(
  clinic: ClinicConfig,
  d: AppointmentEmailData & { status: string }
) {
  const when = formatWhen(d.startIso, clinic.locale.timezone);
  const headline =
    d.status === "confirmed"
      ? "Your appointment is confirmed"
      : d.status === "cancelled"
        ? "Your appointment was cancelled"
        : `Your appointment is now ${d.status}`;
  return {
    subject: `${headline} — ${clinic.branding.name}`,
    html: wrap(
      clinic,
      `<p>Hi ${d.patientName},</p>
       <p>${headline}: <strong>${d.serviceName}</strong> on <strong>${when}</strong>.</p>`
    ),
  };
}

export function reminderEmail(clinic: ClinicConfig, d: AppointmentEmailData) {
  const when = formatWhen(d.startIso, clinic.locale.timezone);
  return {
    subject: `Reminder: your appointment — ${clinic.branding.name}`,
    html: wrap(
      clinic,
      `<p>Hi ${d.patientName},</p>
       <p>This is a reminder for your <strong>${d.serviceName}</strong> appointment
       on <strong>${when}</strong>.</p>`
    ),
  };
}
