import { createTranslator } from "next-intl";
import type { ClinicConfig } from "@config-engine";
import en from "@/locales/en.json";
import my from "@/locales/my.json";

/**
 * Email templates for appointment notifications. Plain, accessible HTML.
 * Subject + body are built from the clinic config + appointment details.
 *
 * Localized to the clinic's DEFAULT language (config.locale.defaultLang). Emails
 * are sent from server actions AND the reminder cron (no request context), so we
 * use next-intl's createTranslator with directly-imported messages rather than
 * the request-scoped getTranslations. Per-patient locale could be captured at
 * booking time later. See docs/08-i18n-languages.md.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MESSAGES: Record<string, any> = { en, my };

export interface AppointmentEmailData {
  patientName: string;
  serviceName: string;
  startIso: string;
  /** patient's preferred language; falls back to the clinic default */
  locale?: string | null;
}

/** Resolve the email language: patient's preference if the clinic enables it. */
function resolveLocale(
  clinic: ClinicConfig,
  preferred?: string | null
): string {
  return preferred && clinic.locale.languages.includes(preferred)
    ? preferred
    : clinic.locale.defaultLang;
}

function emailTranslator(clinic: ClinicConfig, locale: string) {
  const messages = MESSAGES[locale] ?? en;
  return createTranslator({ locale, messages, namespace: "email" });
}

function formatWhen(iso: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const strong = (s: string) => `<strong>${s}</strong>`;

/** Escape user-supplied text before it goes into email HTML. */
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function wrap(
  clinic: ClinicConfig,
  t: ReturnType<typeof emailTranslator>,
  body: string
): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
    <h2 style="color:#111">${clinic.branding.name}</h2>
    ${body}
    <p style="color:#666;font-size:12px;margin-top:24px">
      ${t("automatedFooter", { clinic: clinic.branding.name })}
    </p>
  </div>`;
}

export function bookedEmail(clinic: ClinicConfig, d: AppointmentEmailData) {
  const locale = resolveLocale(clinic, d.locale);
  const t = emailTranslator(clinic, locale);
  const when = formatWhen(d.startIso, clinic.locale.timezone, locale);
  return {
    subject: t("bookedSubject", { clinic: clinic.branding.name }),
    html: wrap(
      clinic,
      t,
      `<p>${t("greeting", { name: esc(d.patientName) })}</p>
       <p>${t("bookedBody", { service: strong(d.serviceName), when: strong(when) })}</p>
       <p>${t("bookedContact")}</p>`
    ),
  };
}

export function statusEmail(
  clinic: ClinicConfig,
  d: AppointmentEmailData & { status: string }
) {
  const locale = resolveLocale(clinic, d.locale);
  const t = emailTranslator(clinic, locale);
  const when = formatWhen(d.startIso, clinic.locale.timezone, locale);
  const headline =
    d.status === "confirmed"
      ? t("confirmedHeadline")
      : d.status === "cancelled"
        ? t("cancelledHeadline")
        : t("statusHeadlineGeneric", { status: d.status });
  return {
    subject: t("statusSubject", { headline, clinic: clinic.branding.name }),
    html: wrap(
      clinic,
      t,
      `<p>${t("greeting", { name: esc(d.patientName) })}</p>
       <p>${t("statusBody", { headline, service: strong(d.serviceName), when: strong(when) })}</p>`
    ),
  };
}

export function reminderEmail(clinic: ClinicConfig, d: AppointmentEmailData) {
  const locale = resolveLocale(clinic, d.locale);
  const t = emailTranslator(clinic, locale);
  const when = formatWhen(d.startIso, clinic.locale.timezone, locale);
  return {
    subject: t("reminderSubject", { clinic: clinic.branding.name }),
    html: wrap(
      clinic,
      t,
      `<p>${t("greeting", { name: esc(d.patientName) })}</p>
       <p>${t("reminderBody", { service: strong(d.serviceName), when: strong(when) })}</p>`
    ),
  };
}
