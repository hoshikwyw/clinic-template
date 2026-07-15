/**
 * appointments module — vertical slice (components/ + server/ + dto + types).
 *
 * Booking, rescheduling, cancellation, admin management, reports. Home of the
 * accessible booking wizard. This file is the module's PUBLIC API — import from
 * "@modules/appointments", never from its server/ internals.
 *
 * Toggleable via ClinicConfig.modules.appointments.
 * See docs/02-architecture.md ("Feature Modules") and docs/03-folder-structure.md.
 */

// UI
export {
  BookingWizard,
  type BookingWizardProps,
  type BookingService,
} from "./components/booking-wizard";

// Patient-facing server actions
export {
  getAvailableSlots,
  createAppointment,
  getMyAppointments,
  cancelMyAppointment,
  rescheduleMyAppointment,
  type CreateAppointmentInput,
  type BookingResult,
  type MyAppointment,
  type CancelResult,
  type RescheduleResult,
} from "./server/booking";

// Staff-facing server actions
export {
  getAllAppointments,
  getAppointmentsPage,
  getDashboardStats,
  updateAppointmentStatus,
  rescheduleAppointment,
  type AdminAppointment,
  type DashboardStats,
  type AdminRescheduleResult,
} from "./server/admin";

// Reports
export { getReportData, type ReportData } from "./server/reports";

// Data contract + constants (pure, client-safe)
export {
  toAppointmentDTO,
  type AppointmentDTO,
  type ActionResult,
} from "./dto";
export { APPOINTMENTS_PAGE_SIZE } from "./pagination";
