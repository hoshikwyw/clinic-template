"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@db/index";
import { patients } from "@db/schema";
import { getSessionUser } from "@auth";

/**
 * Patient profile actions for the logged-in user. Trusted Drizzle connection;
 * ownership is enforced via the session user's auth id.
 */

export type MyProfile = {
  fullName: string;
  phone: string;
  email: string;
  /** ISO date (YYYY-MM-DD) or "" */
  dateOfBirth: string;
};

export async function getMyProfile(): Promise<MyProfile | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const [row] = await db
    .select({
      fullName: patients.fullName,
      phone: patients.phone,
      email: patients.email,
      dateOfBirth: patients.dateOfBirth,
    })
    .from(patients)
    .where(eq(patients.authUserId, user.id))
    .limit(1);

  if (!row) {
    // Account exists but no patient row yet — seed from the session.
    return {
      fullName: user.fullName ?? "",
      phone: "",
      email: user.email,
      dateOfBirth: "",
    };
  }

  return {
    fullName: row.fullName,
    phone: row.phone,
    email: row.email ?? "",
    dateOfBirth: row.dateOfBirth ?? "",
  };
}

const updateProfileInput = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

export interface UpdateProfileResult {
  ok: boolean;
  error?: string;
}

export async function updateMyProfile(
  raw: unknown
): Promise<UpdateProfileResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const parsed = updateProfileInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;
  const dob = input.dateOfBirth ? input.dateOfBirth : null;

  const [existing] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.authUserId, user.id))
    .limit(1);

  if (existing) {
    await db
      .update(patients)
      .set({
        fullName: input.fullName,
        phone: input.phone,
        email: input.email || null,
        dateOfBirth: dob,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, existing.id));
  } else {
    await db.insert(patients).values({
      authUserId: user.id,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email || null,
      dateOfBirth: dob,
    });
  }

  return { ok: true };
}
