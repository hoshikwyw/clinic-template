"use server";

import { z } from "zod";
import { getSessionUser, type UserRole } from "@auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Staff / role management. ADMIN ONLY — assigning roles is privileged, so these
 * require the caller to be an admin (not just any staff). Roles live in the
 * secure app_metadata (set via the service role), never user_metadata.
 */

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") throw new Error("Not authorized");
  return user;
}

export interface StaffMember {
  id: string;
  email: string;
  fullName?: string;
  role: UserRole;
}

async function findUsers() {
  const admin = createAdminClient();
  const users: { id: string; email: string; fullName?: string; role: UserRole }[] =
    [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    for (const u of data.users) {
      users.push({
        id: u.id,
        email: u.email ?? "",
        fullName: u.user_metadata?.full_name as string | undefined,
        role: (u.app_metadata?.role as UserRole | undefined) ?? "patient",
      });
    }
    if (data.users.length < 200) break;
  }
  return users;
}

/** All non-patient users (admins, doctors, staff). */
export async function listStaff(): Promise<StaffMember[]> {
  await requireAdmin();
  const users = await findUsers();
  return users
    .filter((u) => u.role !== "patient")
    .sort((a, b) => a.email.localeCompare(b.email));
}

const roleSchema = z.enum(["admin", "doctor", "staff", "patient"]);

export interface SetRoleResult {
  ok: boolean;
  error?: "invalid-role" | "not-found" | "self-demote" | "failed";
}

async function applyRole(userId: string, role: UserRole): Promise<SetRoleResult> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });
  if (error) return { ok: false, error: "failed" };
  return { ok: true };
}

/** Change an existing user's role by their id. */
export async function setStaffRole(
  userId: string,
  role: string
): Promise<SetRoleResult> {
  const me = await requireAdmin();
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { ok: false, error: "invalid-role" };
  // Guard against an admin locking themselves out.
  if (userId === me.id && parsed.data !== "admin") {
    return { ok: false, error: "self-demote" };
  }
  return applyRole(userId, parsed.data);
}

/** Promote an existing (signed-up) user to a role, looked up by email. */
export async function addStaffByEmail(
  email: string,
  role: string
): Promise<SetRoleResult> {
  await requireAdmin();
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { ok: false, error: "invalid-role" };

  const users = await findUsers();
  const match = users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (!match) return { ok: false, error: "not-found" };

  return applyRole(match.id, parsed.data);
}
