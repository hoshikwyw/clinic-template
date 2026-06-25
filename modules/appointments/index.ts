/**
 * appointments module — vertical slice (components/ + server/ + schema + types colocated).
 *
 * Booking, rescheduling, cancellation. Home of the accessible booking wizard.
 *
 * Toggleable via ClinicConfig.modules.appointments. Public API of the module is this file.
 * See docs/02-architecture.md ("Feature Modules") and docs/03-folder-structure.md.
 */

export {
  BookingWizard,
  type BookingWizardProps,
  type BookingService,
} from "./components/booking-wizard";

