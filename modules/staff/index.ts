/**
 * staff module — vertical slice (server/ + types colocated).
 *
 * Staff & clinician management and role assignment (admin-only). This file is
 * the module's PUBLIC API — import from "@modules/staff", never from its
 * server/ internals.
 *
 * Toggleable via ClinicConfig.modules.staff.
 * See docs/02-architecture.md ("Feature Modules") and docs/03-folder-structure.md.
 */

export {
  listStaff,
  setStaffRole,
  addStaffByEmail,
  type StaffMember,
  type SetRoleResult,
} from "./server/admin";
