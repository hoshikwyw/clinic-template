/**
 * config-engine — the "brain" of the platform.
 *
 * Each clinic is described by a ClinicConfig object (stored in the DB, editable
 * via an admin UI later). The whole product is driven by this config:
 * branding, enabled modules, services, intake forms, booking rules.
 *
 * See docs/02-architecture.md ("Clinic Config (the brain)").
 * NOTE: Phase 0 stub — shapes will be fleshed out + validated with Zod in Phase 1.
 */

export type ClinicSpecialty =
  | "dental"
  | "pediatric"
  | "physio"
  | "dermatology"
  | "general"
  | (string & {}); // allow custom specialties

export interface ClinicBranding {
  name: string;
  logoUrl?: string;
  /** maps onto design tokens — see packages/ui */
  colorScheme?: string;
  font?: string;
}

export interface ClinicLocale {
  languages: string[];
  defaultLang: string;
  timezone: string;
  currency: string;
}

/** Toggleable feature modules — a clinic enables only what it needs. */
export interface ClinicModules {
  appointments: boolean;
  patients: boolean;
  scheduling: boolean;
  notifications: boolean;
  billing: boolean;
  staff: boolean;
  telehealth: boolean;
}

export interface ClinicConfig {
  id: string;
  branding: ClinicBranding;
  locale: ClinicLocale;
  specialty: ClinicSpecialty;
  modules: ClinicModules;
  // services, intakeForm, staffRoles, bookingRules — added in Phase 1
}

/** Phase 1: load a clinic's config by id / slug from the DB. */
export async function loadClinicConfig(_clinicId: string): Promise<ClinicConfig> {
  throw new Error("loadClinicConfig: not implemented (Phase 1)");
}
