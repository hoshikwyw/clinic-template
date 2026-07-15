/**
 * notifications module — appointment emails (confirmation, status, reminders).
 *
 * Sending goes through a provider-agnostic adapter (Resend when keyed, console
 * no-op otherwise — see ./email). Notify calls never throw: a failed email must
 * not break a booking. Toggleable via ClinicConfig.modules.notifications.
 *
 * See docs/02-architecture.md ("Feature Modules").
 */
import { and, eq, gte, lte, ne, isNull, inArray } from "drizzle-orm";
import { db } from "@db/index";
import { appointments, patients } from "@db/schema";
import { getClinicConfig } from "@/config/clinic";
import { getEmailProvider } from "./email";
import { bookedEmail, statusEmail, reminderEmail } from "./messages";

/** Hours before an appointment to send the reminder. */
const REMINDER_WINDOW_HOURS = 24;

interface NotifyData {
  to?: string | null;
  patientName: string;
  serviceName: string;
  startIso: string;
  /** patient's preferred language; falls back to the clinic default */
  locale?: string | null;
}

export async function notifyAppointmentBooked(d: NotifyData): Promise<void> {
  if (!d.to) return;
  if (!getClinicConfig().modules.notifications) return;
  try {
    const { subject, html } = bookedEmail(getClinicConfig(), d);
    await getEmailProvider().send({ to: d.to, subject, html });
  } catch (err) {
    console.error("[notifications] booked email failed:", err);
  }
}

export async function notifyAppointmentStatus(
  d: NotifyData & { status: string }
): Promise<void> {
  if (!d.to) return;
  if (!getClinicConfig().modules.notifications) return;
  try {
    const { subject, html } = statusEmail(getClinicConfig(), d);
    await getEmailProvider().send({ to: d.to, subject, html });
  } catch (err) {
    console.error("[notifications] status email failed:", err);
  }
}

export interface ReminderRunResult {
  processed: number;
  sent: number;
}

/** Max concurrent email sends per reminder run. */
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
 */
export async function sendDueReminders(): Promise<ReminderRunResult> {
  const clinic = getClinicConfig();
  const now = new Date();
  const until = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3_600_000);

  const rows = await db
    .select({
      id: appointments.id,
      serviceName: appointments.serviceName,
      startAt: appointments.startAt,
      email: patients.email,
      name: patients.fullName,
      locale: patients.locale,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(
      and(
        gte(appointments.startAt, now),
        lte(appointments.startAt, until),
        ne(appointments.status, "cancelled"),
        isNull(appointments.reminderSentAt)
      )
    );

  const provider = getEmailProvider();
  const sendable =
    clinic.modules.notifications ? rows.filter((r) => r.email) : [];

  const outcomes = await mapWithConcurrency(
    sendable,
    SEND_CONCURRENCY,
    async (r) => {
      try {
        const { subject, html } = reminderEmail(clinic, {
          patientName: r.name,
          serviceName: r.serviceName,
          startIso: r.startAt.toISOString(),
          locale: r.locale,
        });
        await provider.send({ to: r.email!, subject, html });
        return true;
      } catch (err) {
        console.error("[notifications] reminder email failed:", err);
        return false;
      }
    }
  );
  const sent = outcomes.filter(Boolean).length;

  // Mark every processed row as reminded in one statement, regardless of send
  // outcome — a missing email or a send failure must not retry forever.
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

  return { processed: rows.length, sent };
}
