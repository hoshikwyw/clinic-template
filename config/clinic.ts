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
 * Other files in config/clinics/ are example configs to copy from.
 */
const activeClinic = smileDental;

/** Load + validate this deployment's clinic config (defaults applied). */
export function getClinicConfig(): ClinicConfig {
  return parseClinicConfig(activeClinic);
}
