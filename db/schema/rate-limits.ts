import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";

/**
 * rate_limits — fixed-window counters for abuse protection.
 *
 * Public booking is an UNAUTHENTICATED write, and because a booking locks a
 * start time for the whole clinic, an unthrottled script could consume every
 * slot in the booking horizon in seconds. That is a business outage, not spam.
 *
 * Why Postgres and not an in-memory map or Redis:
 * - Serverless runs many short-lived instances, so an in-memory counter leaks
 *   through immediately — an attacker just gets a fresh instance.
 * - Volumes here are tiny (a clinic books tens of appointments a day), so one
 *   extra upsert per attempt is free, and we already have a database.
 * - No new vendor, no new key to rotate, and it survives a redeploy.
 *
 * Rows are counters, never PHI: `key` is a scope prefix plus a hashed
 * identifier (see lib/rate-limit.ts), never a raw phone number or IP.
 *
 * RLS is enabled with NO policies: anon/authenticated clients can't read or
 * write this table at all. Only the trusted server connection touches it.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    /** `<scope>:<sha256 of the identifier>` — opaque, not reversible. */
    key: text("key").primaryKey(),
    /** attempts recorded in the current window */
    count: integer("count").notNull().default(0),
    /** when the current window opened; a new window resets `count` to 1 */
    windowStart: timestamp("window_start", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // Supports the opportunistic prune of long-expired counters.
    index("rate_limits_window_start_idx").on(t.windowStart),
  ]
).enableRLS();

export type RateLimitRow = typeof rateLimits.$inferSelect;
