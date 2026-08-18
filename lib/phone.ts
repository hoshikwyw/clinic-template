/**
 * Phone number normalisation.
 *
 * Patients type the same number many ways — `09 7712 3456`, `+95 9 771 23456`,
 * `0097797712...`. Booking needs ONE canonical form so that (a) a returning
 * guest is matched to their existing patient record instead of creating a
 * duplicate, and (b) per-patient booking limits can't be bypassed by
 * reformatting. Display always uses whatever the patient typed; only the
 * matching key is normalised.
 *
 * Deliberately not a full libphonenumber: the app is single-tenant, so every
 * patient is in one country, and the clinic declares its dialling code in
 * `locale.phoneCountryCode`. That makes the national ↔ international forms
 * collapse correctly without a 200 kB dependency.
 */

/** Digits only — drops spaces, dashes, brackets, and the leading `+`. */
function digitsOnly(raw: string): string {
  return raw.replace(/\D+/g, "");
}

/**
 * Canonical, comparable form of a phone number: digits only, in international
 * form when the clinic's dialling code is known.
 *
 * @param raw       what the patient typed
 * @param dialCode  clinic dialling code without `+`, e.g. "95" — from
 *                  `config.locale.phoneCountryCode`. Omit it and the number is
 *                  only stripped of formatting.
 * @returns the canonical key, or "" when there are no digits at all.
 */
export function normalizePhone(raw: string, dialCode?: string): string {
  let d = digitsOnly(raw);
  if (!d) return "";

  // International prefix typed as 00 (e.g. 0095…) → bare country code.
  if (d.startsWith("00")) d = d.slice(2);

  const cc = dialCode ? digitsOnly(dialCode) : "";
  if (!cc) return d;

  // Already international.
  if (d.startsWith(cc)) return d;

  // National form with a trunk 0 (09771…) → strip it, then prefix.
  if (d.startsWith("0")) return cc + d.slice(1);

  // Bare national form (9771…).
  return cc + d;
}

/**
 * Do two numbers refer to the same person? Compares canonical forms, then falls
 * back to the last 8 significant digits so a missing/incorrect country code
 * doesn't split one patient into two records.
 */
export function samePhone(a: string, b: string, dialCode?: string): boolean {
  const na = normalizePhone(a, dialCode);
  const nb = normalizePhone(b, dialCode);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.slice(-8) === nb.slice(-8);
}
