/**
 * Patient directory pagination constants. Kept out of server/admin.ts because
 * that is a "use server" module (may only export async Server Functions).
 */

/** Default page size for the patient directory. */
export const PATIENTS_PAGE_SIZE = 20;
