import { parseClinicConfig, type ClinicConfig } from "@config-engine";
import { smileDental } from "./clinics/smile-dental";

/**
 * THE clinic this deployment serves.
 *
 * Single-tenant: one deployment = one clinic. To set up the app for a new
 * client, edit this clinic's config (branding, services, intake form, modules)
 * — or point `activeClinic` at a different config file. No database needed for
 * the config; it's validated at load.
 *
 * Other files in config/clinics/ are example configs to copy from
 * (e.g. little-stars-pediatric — verified to run on this same code in Phase 3).
 */
// Phase 3 (verified): the pediatric config (little-stars-pediatric) was run on
// this exact code with zero changes — proving reusability. Swap this line to
// deploy a different clinic.
const activeClinic = smileDental;

/**
 * Load + validate this deployment's clinic config (defaults applied).
 *
 * Single-tenant + config-in-code means the result is static for the process
 * lifetime, so we validate once and memoize. Avoids re-running full Zod parse
 * on every request/consumer (i18n, every server action, every page).
 */
let cached: ClinicConfig | undefined;
export function getClinicConfig(): ClinicConfig {
  return (cached ??= parseClinicConfig(activeClinic));
}
