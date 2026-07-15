/**
 * patients module — vertical slice (server/ + types colocated).
 *
 * Patient records, staff-facing directory, and the logged-in patient's own
 * profile. This file is the module's PUBLIC API — import from "@modules/patients",
 * never from its server/ internals.
 *
 * Toggleable via ClinicConfig.modules.patients.
 * See docs/02-architecture.md ("Feature Modules") and docs/03-folder-structure.md.
 */

// Staff-facing directory
export {
  getPatientsList,
  getPatientDetail,
  type PatientListItem,
  type PatientsPage,
  type PatientDetail,
} from "./server/admin";

// Logged-in patient's own profile
export {
  getMyProfile,
  updateMyProfile,
  type MyProfile,
  type UpdateProfileResult,
} from "./server/profile";

export { PATIENTS_PAGE_SIZE } from "./pagination";
