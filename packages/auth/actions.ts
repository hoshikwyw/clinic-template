"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@db/index";
import { patients } from "@db/schema";

/**
 * Auth server actions (email + password). Single-tenant: every self sign-up is
 * a patient. Staff/admin roles are assigned out-of-band (later).
 */

export interface AuthResult {
  ok: boolean;
  error?: string;
  /** true when the project requires email confirmation before first login */
  needsConfirmation?: boolean;
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signUp(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}): Promise<AuthResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName, role: "patient" } },
  });
  if (error) return { ok: false, error: error.message };

  // Link a patient record to the new account (trusted DB write).
  if (data.user) {
    await db.insert(patients).values({
      authUserId: data.user.id,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
    });
  }

  return { ok: true, needsConfirmation: !data.session };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
