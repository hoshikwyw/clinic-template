/**
 * config-engine — the "brain" of the platform.
 *
 * Validates and exposes a clinic's ClinicConfig. Pure layer: no DB / app deps,
 * so it can be used anywhere (server, client, scripts). This deployment's active
 * clinic config + loader live in config/clinic.ts (single-tenant).
 *
 * See docs/02-architecture.md.
 */

import {
  clinicConfigSchema,
  type ClinicConfig,
  type ClinicConfigInput,
  type ModuleKey,
} from "./schema";

export * from "./schema";

/**
 * Author a clinic config with full type-checking + inference.
 * Accepts the INPUT shape (fields with defaults are optional). Identity at
 * runtime; validate + apply defaults with parseClinicConfig.
 */
export function defineClinicConfig(
  config: ClinicConfigInput
): ClinicConfigInput {
  return config;
}

/** Validate unknown data into a ClinicConfig (throws on invalid). */
export function parseClinicConfig(raw: unknown): ClinicConfig {
  return clinicConfigSchema.parse(raw);
}

/** Safe variant — returns a result object instead of throwing. */
export function safeParseClinicConfig(raw: unknown) {
  return clinicConfigSchema.safeParse(raw);
}

/** Is a feature module enabled for this clinic? */
export function isModuleEnabled(
  config: ClinicConfig,
  moduleKey: ModuleKey
): boolean {
  return config.modules[moduleKey] === true;
}
