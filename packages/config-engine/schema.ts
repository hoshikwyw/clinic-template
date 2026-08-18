import { z } from "zod";
import { formSchemaSchema } from "@form-engine/schema";

/**
 * config-engine schema — the "brain" of the platform.
 *
 * Each clinic is fully described by a ClinicConfig. The whole product is driven
 * by this object: branding, enabled modules, services, intake forms, booking
 * rules, languages. A new clinic is a config, not a code change.
 *
 * See docs/02-architecture.md ("Clinic Config (the brain)").
 */

/** Well-known specialties (for pickers); any string is allowed. */
export const KNOWN_SPECIALTIES = [
  "dental",
  "pediatric",
  "physio",
  "dermatology",
  "general",
] as const;

export const brandingSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().optional(),
  logoUrl: z.url().optional(),
  /** any CSS color — hex or oklch(...). Injected as the --primary token. */
  primaryColor: z.string().min(1),
  /**
   * Text/icon color that sits ON primaryColor (buttons, active states). Set this
   * whenever primaryColor is light, or button labels can become unreadable —
   * defaults to the theme's near-white foreground otherwise.
   */
  primaryForeground: z.string().optional(),
  accentColor: z.string().optional(),
  /** muted brand color for secondary surfaces (maps to --secondary). */
  secondaryColor: z.string().optional(),
  /** base radius token, e.g. "0.625rem" (smaller = clinical, larger = friendly). */
  radius: z.string().optional(),
  /** font-family stack */
  font: z.string().optional(),
  /**
   * Escape hatch: override ANY design token by name, e.g.
   * `{ "--background": "oklch(0.99 0 0)", "muted": "…" }`. Keys may omit the
   * leading `--`. Applied last, so it wins over the fields above. Lets a clinic
   * retheme fully from config without touching components/CSS.
   */
  tokens: z.record(z.string(), z.string()).optional(),
});
export type Branding = z.infer<typeof brandingSchema>;

export const localeSchema = z
  .object({
    /** enabled language codes, e.g. ["en", "my"] */
    languages: z.array(z.string()).min(1),
    defaultLang: z.string().min(1),
    timezone: z.string().min(1),
    currency: z.string().min(1),
    /**
     * Country dialling code without `+`, e.g. "95" for Myanmar. Used to
     * normalise patient phone numbers so `09771…` and `+959771…` resolve to the
     * same person (see lib/phone.ts). Optional — without it, numbers are only
     * stripped of formatting, which dedupes less reliably.
     */
    phoneCountryCode: z
      .string()
      .regex(/^\d{1,4}$/, "must be digits only, without the leading +")
      .optional(),
  })
  .refine((l) => l.languages.includes(l.defaultLang), {
    error: "defaultLang must be one of the enabled languages",
    path: ["defaultLang"],
  });
export type Locale = z.infer<typeof localeSchema>;

/** Toggleable feature modules — a clinic enables only what it needs. */
export const modulesSchema = z.object({
  appointments: z.boolean(),
  patients: z.boolean(),
  scheduling: z.boolean(),
  notifications: z.boolean(),
  billing: z.boolean(),
  staff: z.boolean(),
  telehealth: z.boolean(),
});
export type ClinicModules = z.infer<typeof modulesSchema>;
export type ModuleKey = keyof ClinicModules;

export const serviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  price: z.number().nonnegative().optional(),
  description: z.string().optional(),
  /** video consultation — gets a join link when modules.telehealth is on */
  telehealth: z.boolean().optional(),
});
export type Service = z.infer<typeof serviceSchema>;

export const bookingRulesSchema = z.object({
  leadTimeHours: z.number().nonnegative().default(0),
  cancellationWindowHours: z.number().nonnegative().default(24),
  maxPerDayPerPatient: z.number().int().positive().optional(),
});
export type BookingRules = z.infer<typeof bookingRulesSchema>;

/** "HH:MM" 24-hour time, e.g. "09:00" or "17:30". */
const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM (24h)");

/** "YYYY-MM-DD" clinic-local calendar date. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((s) => {
    // Reject 2026-02-30 and friends: a typo'd holiday date silently never
    // matches, so the clinic takes bookings on a day it is closed.
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }, "must be a real calendar date");

/**
 * A recurring daily break — lunch, a cleaning block, a ward round. Slots that
 * would overlap it are not offered.
 */
export const scheduleBreakSchema = z
  .object({
    startTime: timeOfDay,
    endTime: timeOfDay,
    /** weekdays it applies to (0=Sun…6=Sat); omit for every open day */
    days: z.array(z.number().int().min(0).max(6)).optional(),
    label: z.string().optional(),
  })
  .refine((b) => b.startTime < b.endTime, {
    error: "startTime must be earlier than endTime",
    path: ["endTime"],
  });
export type ScheduleBreak = z.infer<typeof scheduleBreakSchema>;

/**
 * A one-off override for specific dates — a public holiday, a clinic retreat,
 * or a special Sunday opening.
 *
 * Without this a clinic's weekly hours are a flat rectangle, so the app happily
 * takes bookings on Thingyan and the front desk has to phone everyone back.
 */
export const scheduleExceptionSchema = z
  .object({
    /** first affected clinic-local date */
    from: isoDate,
    /** last affected date, inclusive; defaults to `from` for a single day */
    to: isoDate.optional(),
    label: z.string().optional(),
    /** closed all day (the default), or `false` to declare replacement hours */
    closed: z.boolean().default(true),
    /** replacement opening time — required when `closed` is false */
    openTime: timeOfDay.optional(),
    /** replacement closing time — required when `closed` is false */
    closeTime: timeOfDay.optional(),
  })
  .superRefine((e, ctx) => {
    if (e.to && e.to < e.from) {
      ctx.addIssue({
        code: "custom",
        message: "`to` must not be earlier than `from`",
        path: ["to"],
      });
    }
    if (e.closed) {
      // Silently ignoring hours on a closed day is how a config comes to mean
      // something other than what it says.
      if (e.openTime || e.closeTime) {
        ctx.addIssue({
          code: "custom",
          message:
            "openTime/closeTime have no effect on a closed day — set closed: false to declare special hours",
          path: ["closed"],
        });
      }
      return;
    }
    if (!e.openTime || !e.closeTime) {
      ctx.addIssue({
        code: "custom",
        message: "special hours need both openTime and closeTime",
        path: ["openTime"],
      });
    } else if (e.openTime >= e.closeTime) {
      ctx.addIssue({
        code: "custom",
        message: "openTime must be earlier than closeTime",
        path: ["closeTime"],
      });
    }
  });
export type ScheduleException = z.infer<typeof scheduleExceptionSchema>;

/** Weekly opening hours — drives bookable time slots. */
export const businessHoursSchema = z
  .object({
    /** open weekdays: 0=Sun, 1=Mon … 6=Sat */
    openDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
    openTime: timeOfDay.default("09:00"),
    closeTime: timeOfDay.default("17:00"),
    /** granularity of bookable slots, in minutes */
    slotMinutes: z.number().int().positive().default(30),
    /** how many days ahead patients may book */
    bookingHorizonDays: z.number().int().positive().default(30),
    /** recurring daily breaks (lunch, cleaning) carved out of the open window */
    breaks: z.array(scheduleBreakSchema).default([]),
    /** dated overrides — holidays, closures, special openings */
    exceptions: z.array(scheduleExceptionSchema).default([]),
  })
  // Zero-padded "HH:MM" (24h) sort lexicographically == chronologically. An
  // inverted range would silently yield zero bookable slots.
  .refine((h) => h.openTime < h.closeTime, {
    error: "openTime must be earlier than closeTime",
    path: ["closeTime"],
  });
export type BusinessHours = z.infer<typeof businessHoursSchema>;

/**
 * Labels for the booking contact step. The canonical patient fields are always
 * name + phone (+ optional email), but their labels vary by clinic — e.g. a
 * pediatric clinic books under a "Parent / guardian" while the child's details
 * go in the intake form.
 */
export const bookingContactSchema = z.object({
  nameLabel: z.string().default("Full name"),
  phoneLabel: z.string().default("Phone number"),
  emailLabel: z.string().default("Email (optional)"),
});
export type BookingContact = z.infer<typeof bookingContactSchema>;

/** Delivery channels a clinic can reach patients on. */
export const NOTIFICATION_CHANNELS = ["email", "sms"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * How this clinic notifies patients. Distinct from `modules.notifications`,
 * which is the on/off switch — these are the settings it runs with.
 *
 * `email` is the default only because it needs no gateway account. Note that
 * `patients.email` is optional while `patients.phone` is required, so an
 * email-only clinic silently reaches a fraction of its patients; enabling `sms`
 * is what makes reminders actually land.
 */
export const notificationSettingsSchema = z.object({
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1).default(["email"]),
  /**
   * How long before an appointment the reminder goes out. The cron runs hourly,
   * so this is accurate to the hour.
   */
  reminderHoursBefore: z.number().int().positive().default(24),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

/** Clinic contact details, shown on the help/contact page + landing map. */
export const contactInfoSchema = z.object({
  phone: z.string().optional(),
  email: z.email().optional(),
  address: z.string().optional(),
  /** precise map pin; if omitted, the map falls back to geocoding `address` */
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
});
export type ContactInfo = z.infer<typeof contactInfoSchema>;

/** A help-center FAQ entry (clinic-authored). */
export const faqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});
export type FaqItem = z.infer<typeof faqItemSchema>;

/**
 * A clinician shown on the public site's team section.
 *
 * DERIVED, not authored: fill in `providers` instead and this list is populated
 * from it at parse time. Kept as its own type because the public site only ever
 * needs the display fields.
 */
export const doctorSchema = z.object({
  name: z.string().min(1),
  /** e.g. "Dentist", "Orthodontist", "Pediatrician" */
  role: z.string().min(1),
  bio: z.string().optional(),
});
export type Doctor = z.infer<typeof doctorSchema>;

/**
 * A provider's own working pattern, layered on top of the clinic's.
 *
 * Every field is optional and falls back to the clinic's. The two are
 * INTERSECTED, never merged: a slot is bookable only when the clinic is open
 * AND the provider is working, and breaks from both sides apply. That is the
 * only sane reading — a dentist cannot see patients while the building is shut,
 * so a provider can never open a day the clinic has closed.
 *
 * `slotMinutes` and `bookingHorizonDays` are deliberately absent: those are
 * clinic-wide booking policy, not personal schedule.
 */
export const providerHoursSchema = z
  .object({
    openDays: z.array(z.number().int().min(0).max(6)).optional(),
    openTime: timeOfDay.optional(),
    closeTime: timeOfDay.optional(),
    /** this provider's own breaks, on top of the clinic's */
    breaks: z.array(scheduleBreakSchema).default([]),
    /** leave, conference days, personal closures */
    exceptions: z.array(scheduleExceptionSchema).default([]),
  })
  .refine((h) => !h.openTime || !h.closeTime || h.openTime < h.closeTime, {
    error: "openTime must be earlier than closeTime",
    path: ["closeTime"],
  });
export type ProviderHours = z.infer<typeof providerHoursSchema>;

/**
 * A bookable provider — a dentist, a physio, or equally a chair or a room.
 *
 * This is what lifts the app off its single-appointment-at-a-time floor: the
 * unique-slot constraint is per provider, so a clinic with three dentists can
 * run three parallel chairs. A clinic that configures none still works — an
 * implicit single provider stands in for the clinic itself (see
 * getBookableProviders), which is exactly the old behaviour.
 */
export const providerSchema = z.object({
  /** stable identifier — appointments reference it, so don't renumber it */
  id: z.string().min(1),
  name: z.string().min(1),
  /** e.g. "Dentist", "Orthodontist", "Pediatrician" */
  role: z.string().min(1),
  bio: z.string().optional(),
  /** service ids this provider performs; omit for all of them */
  serviceIds: z.array(z.string()).optional(),
  /** personal working pattern; omit to follow the clinic's hours exactly */
  hours: providerHoursSchema.optional(),
  /** false = temporarily unbookable (on leave, left) but kept for history */
  bookable: z.boolean().default(true),
  /** show on the public site's team section */
  showOnWebsite: z.boolean().default(true),
});
export type Provider = z.infer<typeof providerSchema>;

/**
 * Stands in for "the clinic" when no providers are configured, so
 * appointments.provider_id is never null and the per-provider unique index
 * keeps working for single-provider clinics.
 */
export const DEFAULT_PROVIDER_ID = "clinic";

const clinicConfigBaseSchema = z.object({
  id: z.string().min(1),
  /** URL-safe identifier, e.g. "smile-dental" */
  slug: z.string().min(1),
  specialty: z.string().min(1),
  branding: brandingSchema,
  locale: localeSchema,
  modules: modulesSchema,
  services: z.array(serviceSchema).default([]),
  /** intake form definition — rendered by form-engine */
  intakeForm: formSchemaSchema.default([]),
  bookingRules: bookingRulesSchema,
  businessHours: businessHoursSchema.prefault({}),
  bookingContact: bookingContactSchema.prefault({}),
  /** channels + reminder timing (see modules.notifications for the on/off switch) */
  notifications: notificationSettingsSchema.prefault({}),
  /** help-center contact details + FAQ (optional, clinic-authored) */
  contact: contactInfoSchema.optional(),
  faq: z.array(faqItemSchema).default([]),
  /** public landing-page content (optional, clinic-authored) */
  about: z.string().optional(),
  /**
   * Derived from `providers` at parse time — authoring this directly still
   * works for a clinic that has no bookable providers to describe.
   */
  doctors: z.array(doctorSchema).default([]),
  /** bookable providers / chairs / rooms — see providerSchema */
  providers: z.array(providerSchema).default([]),
  staffRoles: z.array(z.string()).default([]),
});

/**
 * Cross-field invariants that isolated field validation can't catch — these are
 * the config mistakes that break the app silently at runtime, so we fail loudly
 * at load instead. See docs/02-architecture.md ("the brain").
 */
export const clinicConfigSchema = clinicConfigBaseSchema.superRefine(
  (cfg, ctx) => {
    // Service ids must be unique — booking looks services up by id.
    const seen = new Set<string>();
    cfg.services.forEach((s, i) => {
      if (seen.has(s.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate service id "${s.id}"`,
          path: ["services", i, "id"],
        });
      }
      seen.add(s.id);
    });

    // A telehealth service is meaningless unless the telehealth module is on.
    if (!cfg.modules.telehealth) {
      cfg.services.forEach((s, i) => {
        if (s.telehealth) {
          ctx.addIssue({
            code: "custom",
            message: `Service "${s.id}" is marked telehealth, but modules.telehealth is off`,
            path: ["services", i, "telehealth"],
          });
        }
      });
    }

    // SMS needs E.164 numbers, which needs the dialling code. Without it every
    // message would be silently dropped before it reached the gateway — the
    // clinic would believe reminders were going out.
    if (
      cfg.notifications.channels.includes("sms") &&
      !cfg.locale.phoneCountryCode
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "SMS notifications need locale.phoneCountryCode to build E.164 numbers",
        path: ["locale", "phoneCountryCode"],
      });
    }

    // Provider ids must be unique — appointments reference them, and a
    // duplicate would make two people share one calendar.
    const seenProviders = new Set<string>();
    cfg.providers.forEach((p, i) => {
      if (seenProviders.has(p.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate provider id "${p.id}"`,
          path: ["providers", i, "id"],
        });
      }
      seenProviders.add(p.id);

      // A typo'd service id silently removes that service from the provider,
      // which surfaces as mysteriously missing availability.
      p.serviceIds?.forEach((sid, j) => {
        if (!seen.has(sid)) {
          ctx.addIssue({
            code: "custom",
            message: `Provider "${p.id}" lists unknown service id "${sid}"`,
            path: ["providers", i, "serviceIds", j],
          });
        }
      });
    });

    // Every service needs someone who can actually perform it. Without this
    // check the service sits on the booking page offering zero slots forever,
    // and it reads as a bug rather than a config mistake.
    const bookableProviders = cfg.providers.filter((p) => p.bookable);
    if (bookableProviders.length > 0) {
      cfg.services.forEach((s, i) => {
        const covered = bookableProviders.some(
          (p) => !p.serviceIds || p.serviceIds.includes(s.id)
        );
        if (!covered) {
          ctx.addIssue({
            code: "custom",
            message: `No bookable provider offers service "${s.id}" — it would never have availability`,
            path: ["services", i, "id"],
          });
        }
      });
    }
  }
).transform((cfg) => ({
  ...cfg,
  // One source of truth for the team. Providers describe who works here, so the
  // public site's list is derived from them rather than maintained twice. An
  // explicitly authored `doctors` list still wins, for a clinic that wants to
  // show people it has nothing bookable for.
  doctors:
    cfg.doctors.length > 0
      ? cfg.doctors
      : cfg.providers
          .filter((p) => p.showOnWebsite)
          .map((p) => ({ name: p.name, role: p.role, bio: p.bio })),
}));

/** Output type (after parse — defaults applied). Use this everywhere downstream. */
export type ClinicConfig = z.infer<typeof clinicConfigSchema>;

/** Input type (for authoring configs — fields with defaults are optional). */
export type ClinicConfigInput = z.input<typeof clinicConfigSchema>;
