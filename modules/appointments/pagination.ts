/**
 * Appointments pagination constants. Client-safe (no DB import) so it can flow
 * through the module barrel — kept out of the "use server" action modules.
 */

/** Default page size for the admin appointments list. */
export const APPOINTMENTS_PAGE_SIZE = 20;
