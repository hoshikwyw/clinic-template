"use server";

import { sql, gte } from "drizzle-orm";
import { db } from "@db/index";
import { appointments } from "@db/schema";
import { requireStaff } from "@auth";
import { getClinicConfig } from "@/config/clinic";

/**
 * Staff-only appointment analytics. Aggregates over the appointments table —
 * no extra storage. See docs/06-roadmap-phases.md (Phase 4 reporting).
 */

export interface ReportData {
  total: number;
  byStatus: Record<string, number>;
  byService: { service: string; count: number }[];
  daily: { date: string; count: number }[];
}

const DAILY_WINDOW_DAYS = 14;

export async function getReportData(): Promise<ReportData> {
  await requireStaff();
  const tz = getClinicConfig().locale.timezone;
  const since = new Date(Date.now() - DAILY_WINDOW_DAYS * 86_400_000);

  // Bucket bookings by their creation date in the clinic timezone, in SQL —
  // returns at most DAILY_WINDOW_DAYS grouped rows instead of every row.
  const dayExpr = sql<string>`to_char((${appointments.createdAt} AT TIME ZONE ${tz})::date, 'YYYY-MM-DD')`;

  // The three aggregates are independent — run them concurrently.
  const [statusRows, serviceRows, dailyRows] = await Promise.all([
    db
      .select({ status: appointments.status, count: sql<number>`count(*)::int` })
      .from(appointments)
      .groupBy(appointments.status),
    db
      .select({
        service: appointments.serviceName,
        count: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .groupBy(appointments.serviceName)
      .orderBy(sql`count(*) desc`)
      .limit(8),
    db
      .select({ date: dayExpr, count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(gte(appointments.createdAt, since))
      // Group by the output ordinal, not the fragment: reusing dayExpr would
      // emit a different bind-param number for `tz`, and Postgres compares
      // GROUP BY expressions by parse tree (distinct Params aren't equal).
      .groupBy(sql`1`),
  ]);

  // Seed every day in the window (clinic tz) so the chart has no gaps, then
  // fill from the grouped SQL result.
  const enCA = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const counts = new Map<string, number>();
  for (let i = DAILY_WINDOW_DAYS - 1; i >= 0; i--) {
    counts.set(enCA.format(new Date(Date.now() - i * 86_400_000)), 0);
  }
  for (const r of dailyRows) {
    if (counts.has(r.date)) counts.set(r.date, Number(r.count));
  }

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const r of statusRows) {
    byStatus[r.status] = Number(r.count);
    total += Number(r.count);
  }

  return {
    total,
    byStatus,
    byService: serviceRows.map((r) => ({
      service: r.service,
      count: Number(r.count),
    })),
    daily: [...counts.entries()].map(([date, count]) => ({ date, count })),
  };
}
