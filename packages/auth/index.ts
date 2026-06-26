/**
 * auth — thin wrapper around the auth provider (Supabase Auth).
 *
 * Vendor-wrapping principle: Supabase-specific auth code lives ONLY here, so
 * swapping providers later is an adapter change, not a rewrite. Single-tenant,
 * so there is no clinicId — roles distinguish patient vs clinician/admin.
 *
 * See docs/01-tech-stack.md ("vendor-wrapping principle").
 */
import { createClient } from "@/lib/supabase/server";

export type UserRole = "patient" | "doctor" | "staff" | "admin";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
}

/** The current authenticated user, or null. Safe to call in Server Components. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // SECURITY: authorization role comes from app_metadata (set only via the
  // service role / dashboard), NOT user_metadata (which users can self-edit).
  const role =
    (user.app_metadata?.role as UserRole | undefined) ?? "patient";

  return {
    id: user.id,
    email: user.email ?? "",
    role,
    fullName: user.user_metadata?.full_name as string | undefined,
  };
}

/** Staff-level access = anyone who is not a plain patient. */
export function isStaff(role: UserRole): boolean {
  return role !== "patient";
}

/** Admin = full access, including staff/role management. */
export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

/** Throws if there is no staff-level user. Use to guard staff-only actions. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !isStaff(user.role)) {
    throw new Error("Not authorized");
  }
  return user;
}
