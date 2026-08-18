import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP for a Server Action / Route Handler.
 *
 * Trust model: behind Vercel (and any sane proxy) `x-forwarded-for` is
 * rewritten by the edge, so the LEFT-most entry is the real client. Read
 * directly by a self-hosted server with no proxy in front, the header is
 * attacker-controlled — which is why the value is only ever used as a rate-limit
 * bucket, never for authorisation.
 *
 * Returns "unknown" when no header is present. That deliberately collapses all
 * header-less callers into one shared bucket rather than exempting them.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();

  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return h.get("x-real-ip")?.trim() || "unknown";
}
