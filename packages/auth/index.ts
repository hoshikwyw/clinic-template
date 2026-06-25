/**
 * auth — thin wrapper around the auth provider (Supabase Auth).
 *
 * Vendor-wrapping principle: Supabase-specific auth code lives ONLY here, so
 * swapping providers later is an adapter change, not a rewrite.
 *
 * Roles drive the Patient/Staff app's role-aware views (patient vs clinician)
 * and the Admin Dashboard. Enforced together with DB Row-Level Security.
 *
 * See docs/01-tech-stack.md ("vendor-wrapping principle").
 * NOTE: Phase 0 stub — implemented in Phase 0/1 once Supabase keys are set.
 */

export type UserRole = "patient" | "doctor" | "staff" | "admin";

export interface SessionUser {
  id: string;
  clinicId: string;
  role: UserRole;
  email: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  throw new Error("getSessionUser: not implemented (wire Supabase Auth)");
}
