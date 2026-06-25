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
  accentColor: z.string().optional(),
  /** base radius token, e.g. "0.625rem" */
  radius: z.string().optional(),
  /** font-family stack */
  font: z.string().optional(),
});
export type Branding = z.infer<typeof brandingSchema>;

export const localeSchema = z.object({
  /** enabled language codes, e.g. ["en", "my"] */
  languages: z.array(z.string()).min(1),
  defaultLang: z.string().min(1),
  timezone: z.string().min(1),
  currency: z.string().min(1),
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

/** Weekly opening hours — drives bookable time slots. */
export const businessHoursSchema = z.object({
  /** open weekdays: 0=Sun, 1=Mon … 6=Sat */
  openDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  openTime: timeOfDay.default("09:00"),
  closeTime: timeOfDay.default("17:00"),
  /** granularity of bookable slots, in minutes */
  slotMinutes: z.number().int().positive().default(30),
  /** how many days ahead patients may book */
  bookingHorizonDays: z.number().int().positive().default(30),
});
export type BusinessHours = z.infer<typeof businessHoursSchema>;

export const clinicConfigSchema = z.object({
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
  staffRoles: z.array(z.string()).default([]),
});
/** Output type (after parse — defaults applied). Use this everywhere downstream. */
export type ClinicConfig = z.infer<typeof clinicConfigSchema>;

/** Input type (for authoring configs — fields with defaults are optional). */
export type ClinicConfigInput = z.input<typeof clinicConfigSchema>;
