import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@db/index";

/**
 * Fixed-window rate limiting, backed by the `rate_limits` table.
 *
 * See db/schema/rate-limits.ts for why this lives in Postgres rather than in
 * memory or Redis.
 *
 * Fixed window (not sliding) is deliberate: it is one atomic upsert, it needs
 * no history rows, and at clinic volumes the burst a fixed window permits at a
 * boundary (up to 2× the limit) is irrelevant — we are stopping scripts, not
 * shaving microseconds off a public API.
 */

/** Identifiers are hashed so the table never holds a phone number or an IP. */
function hashIdentifier(identifier: string): string {
  return createHash("sha256").update(identifier).digest("hex").slice(0, 32);
}

export interface RateLimitOptions {
  /** what is being limited, e.g. "booking:ip" — namespaces the counter */
  scope: string;
  /** who is being limited (IP, normalised phone, user id) — hashed before storage */
  identifier: string;
  /** attempts allowed per window */
  limit: number;
  /** window length in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** attempts left in the current window (0 once blocked) */
  remaining: number;
  /** seconds until the window resets — for a Retry-After header or copy */
  retryAfterSeconds: number;
}

/**
 * Record an attempt and report whether it is allowed.
 *
 * Counts the attempt even when it ends up blocked, so a caller hammering the
 * endpoint keeps the window open rather than getting a free retry each time.
 *
 * FAILS OPEN. If the counter query errors we let the request through and log
 * it: every caller of this function is about to hit the same database anyway,
 * so a limiter outage means a database outage, and the real work will fail on
 * its own. Blocking real patients because a bookkeeping table is unavailable
 * would be the worse failure.
 */
export async function checkRateLimit(
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const key = `${opts.scope}:${hashIdentifier(opts.identifier)}`;

  try {
    // One statement, so concurrent attempts can't both read a stale count.
    // The CASE arms reset the window in place instead of needing a delete.
    const rows = await db.execute<{ count: number; elapsed: number }>(sql`
      insert into rate_limits (key, count, window_start)
      values (${key}, 1, now())
      on conflict (key) do update set
        count = case
          when rate_limits.window_start <= now() - make_interval(secs => ${opts.windowSeconds}::double precision)
          then 1
          else rate_limits.count + 1
        end,
        window_start = case
          when rate_limits.window_start <= now() - make_interval(secs => ${opts.windowSeconds}::double precision)
          then now()
          else rate_limits.window_start
        end
      returning
        rate_limits.count,
        extract(epoch from (now() - rate_limits.window_start))::int as elapsed
    `);

    const row = rows[0];
    if (!row) return { ok: true, remaining: opts.limit - 1, retryAfterSeconds: 0 };

    const count = Number(row.count);
    const elapsed = Number(row.elapsed);
    const ok = count <= opts.limit;

    return {
      ok,
      remaining: Math.max(0, opts.limit - count),
      retryAfterSeconds: ok ? 0 : Math.max(1, opts.windowSeconds - elapsed),
    };
  } catch (err) {
    console.error(`[rate-limit] check failed for scope "${opts.scope}":`, err);
    return { ok: true, remaining: opts.limit, retryAfterSeconds: 0 };
  }
}

/**
 * Apply several limits at once (e.g. per-IP burst AND per-IP daily AND
 * per-phone daily) and return the first breach.
 *
 * Every limit is evaluated even after one fails, on purpose: each attempt must
 * count against all of its windows, or an attacker could stay under the daily
 * cap forever by tripping the cheap burst limit first.
 */
export async function checkRateLimits(
  limits: RateLimitOptions[]
): Promise<RateLimitResult> {
  const results = await Promise.all(limits.map(checkRateLimit));
  const breach = results.find((r) => !r.ok);
  if (breach) return breach;

  return {
    ok: true,
    remaining: Math.min(...results.map((r) => r.remaining)),
    retryAfterSeconds: 0,
  };
}

/**
 * Delete counters whose window closed long ago. Cheap, and keeps the table from
 * growing without bound; call it from the existing reminder cron rather than
 * adding a second schedule.
 */
export async function pruneRateLimits(
  olderThanSeconds = 86_400
): Promise<void> {
  try {
    await db.execute(sql`
      delete from rate_limits
      where window_start
            <= now() - make_interval(secs => ${olderThanSeconds}::double precision)
    `);
  } catch (err) {
    console.error("[rate-limit] prune failed:", err);
  }
}
