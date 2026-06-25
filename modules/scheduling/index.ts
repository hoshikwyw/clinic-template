/**
 * scheduling module — vertical slice (components/ + server/ + schema + types colocated).
 *
 * Provider availability, rooms, calendar, booking rules.
 *
 * Toggleable via ClinicConfig.modules.scheduling. Public API of the module is this file.
 * See docs/02-architecture.md ("Feature Modules") and docs/03-folder-structure.md.
 */

export {
  generateDaySlots,
  zonedWallTimeToUtc,
  type Slot,
  type DaySlots,
  type GenerateSlotsOptions,
} from "./slots";
