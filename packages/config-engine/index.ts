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
  DEFAULT_PROVIDER_ID,
  type ClinicConfig,
  type ClinicConfigInput,
  type ModuleKey,
  type Provider,
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

/**
 * The clinic's bookable providers.
 *
 * A clinic that configures none still gets exactly one — an implicit provider
 * standing in for the clinic itself. That keeps every downstream caller
 * (availability, booking, the unique-slot index) on a single code path instead
 * of branching on "does this clinic do multi-provider", and it means the
 * single-chair clinic behaves precisely as it did before providers existed.
 */
export function getBookableProviders(config: ClinicConfig): Provider[] {
  const configured = config.providers.filter((p) => p.bookable);
  if (configured.length > 0) return configured;

  return [
    {
      id: DEFAULT_PROVIDER_ID,
      name: config.branding.name,
      role: config.specialty,
      bookable: true,
      showOnWebsite: false,
    },
  ];
}

/**
 * Providers who can perform a given service, in config order — which is also
 * the order auto-assignment picks from, so a clinic can express preference
 * ("give it to the senior dentist first") just by ordering the list.
 */
export function getProvidersForService(
  config: ClinicConfig,
  serviceId: string
): Provider[] {
  return getBookableProviders(config).filter(
    (p) => !p.serviceIds || p.serviceIds.includes(serviceId)
  );
}

/** Look up a provider by id, including the implicit single provider. */
export function findProvider(
  config: ClinicConfig,
  providerId: string
): Provider | undefined {
  return getBookableProviders(config).find((p) => p.id === providerId);
}

/** Does this clinic actually run more than one calendar? Drives UI. */
export function hasMultipleProviders(config: ClinicConfig): boolean {
  return getBookableProviders(config).length > 1;
}
