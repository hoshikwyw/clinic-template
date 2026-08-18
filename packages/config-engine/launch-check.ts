import type { ClinicConfig } from "./schema";

/**
 * Pre-launch readiness audit for a clinic deployment.
 *
 * Zod already rejects a config that is *invalid*. This catches a config that is
 * merely *unfinished* — placeholder text from the template, no way for a patient
 * to phone the clinic, holidays that all expired last year, notifications
 * enabled with no gateway configured. None of these throw; they just quietly
 * make a live clinic worse, and they are exactly what gets missed at 11pm the
 * night before a launch.
 *
 * Deliberately pure: everything it inspects is passed in, so the whole checklist
 * is unit-testable and can run in CI as easily as from a script. See
 * scripts/launch-check.ts for the wrapper that gathers the inputs, and
 * docs/09-new-clinic-checklist.md for the human version.
 */

export type CheckLevel = "error" | "warn" | "info";

export interface CheckFinding {
  level: CheckLevel;
  /** grouping label, e.g. "Config", "Notifications", "Environment" */
  area: string;
  /** what is wrong, in one line */
  message: string;
  /** what to do about it */
  fix?: string;
  /**
   * True when the finding comes from the environment (secrets, gateways) rather
   * than the config. CI has no secrets, so `--config-only` drops these — the
   * config half is still worth gating a merge on.
   */
  dependsOnEnv?: boolean;
}

export interface LaunchCheckInput {
  config: ClinicConfig;
  /** process.env, or a subset — only the keys below are read */
  env: Record<string, string | undefined>;
  /**
   * Result of trying to read the icon assets. `undefined` means the check was
   * skipped (e.g. the files could not be read at all), which is reported rather
   * than silently passing.
   */
  icons?: { path: string; exists: boolean; isPlaceholder?: boolean }[];
  /** "today" in ISO date form, for the expired-holiday check */
  today?: string;
}

/**
 * Strings the template ships with. Finding one in a live config means someone
 * scaffolded a clinic and never filled that field in.
 */
const PLACEHOLDERS = [
  "Your Clinic Name",
  "template-clinic",
  "clinic_template",
  "Clinic Name",
  "EDIT:",
  "example.com",
  ".example",
  "your-clinic",
];

function containsPlaceholder(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return PLACEHOLDERS.find((p) =>
    value.toLowerCase().includes(p.toLowerCase())
  );
}

/** Today's date in the clinic's own timezone, as "YYYY-MM-DD". */
function clinicToday(config: ClinicConfig, override?: string): string {
  if (override) return override;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.locale.timezone,
  }).format(new Date());
}

/**
 * Run the audit. Returns findings in severity order; an empty `error` list means
 * the deployment is safe to launch.
 */
export function runLaunchChecks(input: LaunchCheckInput): CheckFinding[] {
  const { config, env } = input;
  const out: CheckFinding[] = [];
  const add = (
    level: CheckLevel,
    area: string,
    message: string,
    fix?: string
  ) => out.push({ level, area, message, fix });

  /** Same, for findings that read process.env rather than the config. */
  const addEnv = (
    level: CheckLevel,
    area: string,
    message: string,
    fix?: string
  ) => out.push({ level, area, message, fix, dependsOnEnv: true });

  const today = clinicToday(config, input.today);

  // ---- Identity & branding ------------------------------------------------
  for (const [label, value] of [
    ["branding.name", config.branding.name],
    ["branding.shortName", config.branding.shortName],
    ["slug", config.slug],
    ["id", config.id],
  ] as const) {
    const hit = containsPlaceholder(value);
    if (hit) {
      add(
        "error",
        "Config",
        `${label} still contains template text ("${hit}")`,
        "Fill it in — this is patient-visible and appears in the PWA install prompt."
      );
    }
  }

  // ---- Contact ------------------------------------------------------------
  if (!config.contact?.phone) {
    add(
      "error",
      "Contact",
      "No contact phone number",
      "Set contact.phone. Cancellations outside the window tell patients to call — with no number they cannot."
    );
  }
  if (!config.contact?.address) {
    add("warn", "Contact", "No address", "Set contact.address so the landing page can show a map.");
  } else if (!config.contact.coordinates) {
    add(
      "info",
      "Contact",
      "No map coordinates — the map falls back to geocoding the address",
      "Set contact.coordinates for a precise pin."
    );
  }
  const contactEmailHit = containsPlaceholder(config.contact?.email);
  if (contactEmailHit) {
    add(
      "error",
      "Contact",
      `contact.email is still an example address ("${config.contact?.email}")`,
      "Use the clinic's real address."
    );
  }

  // ---- Services & providers ----------------------------------------------
  if (config.services.length === 0) {
    add(
      "error",
      "Services",
      "No services configured — nothing is bookable",
      "Add at least one service."
    );
  }
  if (config.providers.length === 0) {
    add(
      "info",
      "Providers",
      "No providers configured — the clinic runs as a single calendar",
      "Add `providers` if more than one appointment can run at a time."
    );
  }

  // ---- Booking rules ------------------------------------------------------
  const horizonHours = config.businessHours.bookingHorizonDays * 24;
  if (config.bookingRules.leadTimeHours >= horizonHours) {
    add(
      "error",
      "Booking",
      `leadTimeHours (${config.bookingRules.leadTimeHours}) is beyond the whole booking horizon (${config.businessHours.bookingHorizonDays} days)`,
      "No slot can ever satisfy both. Lower the lead time or extend the horizon."
    );
  }
  if (config.bookingRules.cancellationWindowHours >= horizonHours) {
    add(
      "warn",
      "Booking",
      "cancellationWindowHours is longer than the booking horizon — patients will never be able to cancel online",
      "Lower it, or make sure the clinic expects every change to come by phone."
    );
  }

  // ---- Schedule -----------------------------------------------------------
  const exceptions = config.businessHours.exceptions;
  if (exceptions.length === 0) {
    add(
      "warn",
      "Schedule",
      "No dated exceptions — the clinic will take bookings on every public holiday",
      "Add businessHours.exceptions for this year's holidays."
    );
  } else {
    const upcoming = exceptions.filter((e) => (e.to ?? e.from) >= today);
    if (upcoming.length === 0) {
      add(
        "error",
        "Schedule",
        `All ${exceptions.length} schedule exception(s) are in the past`,
        "Dated exceptions need a yearly refresh — once expired they stop matching and the clinic silently opens on holidays."
      );
    } else if (upcoming.length < exceptions.length) {
      add(
        "info",
        "Schedule",
        `${exceptions.length - upcoming.length} schedule exception(s) have expired`,
        "Harmless, but worth tidying when you add next year's dates."
      );
    }
  }
  if (config.businessHours.breaks.length === 0) {
    add(
      "info",
      "Schedule",
      "No recurring breaks — the clinic will take bookings straight through lunch",
      "Add businessHours.breaks if that is not intended."
    );
  }

  // ---- Public site --------------------------------------------------------
  if (!config.about) {
    add("warn", "Public site", "No `about` text — the landing page will look bare");
  }
  if (config.doctors.length === 0) {
    add(
      "warn",
      "Public site",
      "No team to show — the landing page's team section will be empty",
      "Add `providers` (the team list is derived from them) or an explicit `doctors` list."
    );
  }
  if (config.faq.length === 0) {
    add("warn", "Public site", "No FAQ entries — the help page will be nearly empty");
  }
  if (config.intakeForm.length === 0) {
    add(
      "info",
      "Booking",
      "No intake form — booking collects only name and phone",
      "Fine for some clinics; add `intakeForm` to ask clinical questions up front."
    );
  }

  // ---- Notifications ------------------------------------------------------
  if (config.modules.notifications) {
    const { channels } = config.notifications;

    if (channels.includes("email") && !env.RESEND_API_KEY) {
      addEnv(
        "error",
        "Notifications",
        "Email is an enabled channel but RESEND_API_KEY is not set — emails are logged, not sent",
        "Set RESEND_API_KEY and EMAIL_FROM, or drop \"email\" from notifications.channels."
      );
    }
    if (channels.includes("email") && env.RESEND_API_KEY && !env.EMAIL_FROM) {
      addEnv(
        "warn",
        "Notifications",
        "EMAIL_FROM is unset — mail goes out from the Resend sandbox address",
        "Set EMAIL_FROM to a verified domain, or deliverability will suffer."
      );
    }
    if (channels.includes("sms") && !env.SMS_PROVIDER) {
      addEnv(
        "error",
        "Notifications",
        "SMS is an enabled channel but SMS_PROVIDER is not set — messages are logged, not sent",
        "Set SMS_PROVIDER=twilio or webhook with its credentials."
      );
    }
    if (!channels.includes("sms")) {
      add(
        "warn",
        "Notifications",
        "SMS is off — patients without an email address get no reminders at all",
        "patients.phone is required and email is not. Enabling \"sms\" is what makes reminders reach everyone."
      );
    }
    if (!env.CRON_SECRET) {
      addEnv(
        "error",
        "Notifications",
        "CRON_SECRET is unset — the reminder cron fails closed, so NO reminders will be sent",
        "Set CRON_SECRET (Vercel Cron sends it as a Bearer token)."
      );
    }
  }

  // ---- Environment --------------------------------------------------------
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL",
  ]) {
    if (!env[key]) {
      addEnv("error", "Environment", `${key} is not set`, "See .env.example.");
    }
  }
  if (env.DATABASE_URL && !env.DATABASE_URL.includes(":6543")) {
    addEnv(
      "warn",
      "Environment",
      "DATABASE_URL does not use the Supabase transaction pooler (port 6543)",
      "Serverless functions exhaust direct connections quickly — use the pooler URL."
    );
  }

  // ---- Assets -------------------------------------------------------------
  if (input.icons === undefined) {
    add(
      "info",
      "Assets",
      "Icon files were not checked",
      "Verify app/icon.svg, app/favicon.ico and public/icon.svg are the clinic's own."
    );
  } else {
    for (const icon of input.icons) {
      if (!icon.exists) {
        // A warning, not a blocker: the app still works without it, the browser
        // just shows a default mark. `error` is reserved for things that break
        // something real for a patient.
        add(
          "warn",
          "Assets",
          `${icon.path} is missing`,
          "Add the clinic's own icon — Next generates the app icon and favicon from these."
        );
      } else if (icon.isPlaceholder) {
        add(
          "warn",
          "Assets",
          `${icon.path} still looks like the starter asset`,
          "Swap in the clinic's own icon — it is what appears on the patient's home screen."
        );
      }
    }
  }

  const order: Record<CheckLevel, number> = { error: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/** Convenience: does this deployment have any blocking problem? */
export function hasBlockingFindings(findings: CheckFinding[]): boolean {
  return findings.some((f) => f.level === "error");
}
