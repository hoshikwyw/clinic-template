/**
 * notifications module — appointment messages (confirmation, status, reminders)
 * over every channel the clinic has enabled.
 *
 * Sending goes through provider-agnostic adapters (./email, ./sms), each with a
 * console no-op when unconfigured. Which channels are used is clinic config
 * (`notifications.channels`), not code.
 *
 * Notify calls NEVER throw: a failed message must not break a booking, and a
 * dead SMS gateway must not stop the email going out. Every failure is logged.
 *
 * Toggleable via ClinicConfig.modules.notifications.
 * See docs/02-architecture.md ("Feature Modules").
 */
import { and, eq, gte, lte, isNull, inArray } from "drizzle-orm";
import { db } from "@db/index";
import { appointments, patients, OCCUPYING_STATUSES } from "@db/schema";
import { getClinicConfig } from "@/config/clinic";
import { toE164 } from "@/lib/phone";
import { getEmailProvider } from "./email";
import { getSmsProvider } from "./sms";
import {
  bookedEmail,
  statusEmail,
  reminderEmail,
  bookedSms,
  statusSms,
  reminderSms,
} from "./messages";

interface NotifyData {
  /** email address, when we have one — patients.email is optional */
  to?: string | null;
  /** phone as the patient typed it; normalised to E.164 before sending */
  phone?: string | null;
  patientName: string;
  serviceName: string;
  startIso: string;
  /** patient's preferred language; falls back to the clinic default */
  locale?: string | null;
  /** clinician the appointment is with, when the clinic runs more than one */
  providerName?: string | null;
}

/** Is this channel switched on for the clinic? */
function channelEnabled(channel: "email" | "sms"): boolean {
  const clinic = getClinicConfig();
  return (
    clinic.modules.notifications &&
    clinic.notifications.channels.includes(channel)
  );
}

/**
 * Deliver one notification over every enabled channel.
 *
 * Channels are independent: each is attempted, each failure is caught and
 * logged separately, and none of them can surface as an exception to the
 * caller. A booking must succeed even when every gateway is down.
 */
async function dispatch(
  kind: string,
  d: NotifyData,
  build: {
    email: () => { subject: string; html: string };
    sms: () => string;
  }
): Promise<void> {
  const clinic = getClinicConfig();
  const sends: Promise<void>[] = [];

  if (channelEnabled("email") && d.to) {
    sends.push(
      (async () => {
        try {
          const { subject, html } = build.email();
          await getEmailProvider().send({ to: d.to!, subject, html });
        } catch (err) {
          console.error(`[notifications] ${kind} email failed:`, err);
        }
      })()
    );
  }

  if (channelEnabled("sms") && d.phone) {
    // Unroutable numbers are dropped here rather than at the gateway, so the
    // log says which patient record needs fixing.
    const e164 = toE164(d.phone, clinic.locale.phoneCountryCode);
    if (!e164) {
      console.error(
        `[notifications] ${kind} sms skipped: phone is not routable to E.164`
      );
    } else {
      sends.push(
        (async () => {
          try {
            await getSmsProvider().send({ to: e164, text: build.sms() });
          } catch (err) {
            console.error(`[notifications] ${kind} sms failed:`, err);
          }
        })()
      );
    }
  }

  await Promise.all(sends);
}

export async function notifyAppointmentBooked(d: NotifyData): Promise<void> {
  const clinic = getClinicConfig();
  await dispatch("booked", d, {
    email: () => bookedEmail(clinic, d),
    sms: () => bookedSms(clinic, d),
  });
}

export async function notifyAppointmentStatus(
  d: NotifyData & { status: string }
): Promise<void> {
  const clinic = getClinicConfig();
  await dispatch("status", d, {
    email: () => statusEmail(clinic, d),
    sms: () => statusSms(clinic, d),
  });
}

export interface ReminderRunResult {
  /** appointments in the reminder window that had not been reminded yet */
  processed: number;
  /** of those, how many we managed to notify on at least one channel */
  sent: number;
}

/** Max concurrent sends per reminder run — one clinic, one small mailbox. */
const SEND_CONCURRENCY = 5;

/** Run `fn` over `items` with at most `limit` in flight; preserves order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

/**
 * Send reminders for appointments starting within the reminder window that
 * haven't been reminded yet. Idempotent via appointments.reminderSentAt.
 * Intended to be called on a schedule (see app/api/cron/reminders).
 *
 * How far ahead is clinic config (`notifications.reminderHoursBefore`) — a
 * dentist wants 24 hours, a busy walk-in clinic may want 2.
 */
export async function sendDueReminders(): Promise<ReminderRunResult> {
  const clinic = getClinicConfig();
  const now = new Date();
  const until = new Date(
    now.getTime() + clinic.notifications.reminderHoursBefore * 3_600_000
  );

  const rows = await db
    .select({
      id: appointments.id,
      serviceName: appointments.serviceName,
      startAt: appointments.startAt,
      providerName: appointments.providerName,
      email: patients.email,
      phone: patients.phone,
      name: patients.fullName,
      locale: patients.locale,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(
      and(
        gte(appointments.startAt, now),
        lte(appointments.startAt, until),
        inArray(appointments.status, [...OCCUPYING_STATUSES]),
        isNull(appointments.reminderSentAt)
      )
    );

  // Someone is reachable if any enabled channel has a contact detail for them.
  // With SMS on this is effectively everyone, since phone is required — which
  // is the entire reason the channel exists.
  const reachable = rows.filter(
    (r) =>
      (channelEnabled("email") && r.email) || (channelEnabled("sms") && r.phone)
  );

  const outcomes = await mapWithConcurrency(
    reachable,
    SEND_CONCURRENCY,
    async (r) => {
      // dispatch() swallows per-channel failures, so reaching here means we
      // attempted every channel we could for this patient.
      await dispatch("reminder", {
        to: r.email,
        phone: r.phone,
        patientName: r.name,
        serviceName: r.serviceName,
        startIso: r.startAt.toISOString(),
        locale: r.locale,
        providerName: r.providerName,
      }, {
        email: () =>
          reminderEmail(clinic, {
            patientName: r.name,
            serviceName: r.serviceName,
            startIso: r.startAt.toISOString(),
            locale: r.locale,
            providerName: r.providerName,
          }),
        sms: () =>
          reminderSms(clinic, {
            patientName: r.name,
            serviceName: r.serviceName,
            startIso: r.startAt.toISOString(),
            locale: r.locale,
            providerName: r.providerName,
          }),
      });
      return true;
    }
  );

  // Mark every processed row as reminded regardless of outcome — a patient with
  // no contact details, or a gateway outage, must not make this row retry on
  // every run forever.
  if (rows.length > 0) {
    await db
      .update(appointments)
      .set({ reminderSentAt: new Date() })
      .where(
        inArray(
          appointments.id,
          rows.map((r) => r.id)
        )
      );
  }

  return { processed: rows.length, sent: outcomes.length };
}

// Adapters are exported so a deployment can swap or wrap them; app code should
// use the notify* helpers above rather than sending directly.
export { getEmailProvider, type EmailProvider, type EmailMessage } from "./email";
export { getSmsProvider, type SmsProvider, type SmsMessage } from "./sms";

// Templates, for previewing a clinic's messages and for tests. Sending still
// goes through the notify* helpers so channel selection stays in one place.
export {
  bookedEmail,
  statusEmail,
  reminderEmail,
  bookedSms,
  statusSms,
  reminderSms,
  type AppointmentEmailData,
} from "./messages";
