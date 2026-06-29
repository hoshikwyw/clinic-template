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

  const statusRows = await db
    .select({
      status: appointments.status,
      count: sql<number>`count(*)::int`,
    })
    .from(appointments)
    .groupBy(appointments.status);

  const serviceRows = await db
    .select({
      service: appointments.serviceName,
      count: sql<number>`count(*)::int`,
    })
    .from(appointments)
    .groupBy(appointments.serviceName)
    .orderBy(sql`count(*) desc`)
    .limit(8);

  // Bookings (by creation date) over the last N days, bucketed in clinic tz.
  const since = new Date(Date.now() - DAILY_WINDOW_DAYS * 86_400_000);
  const created = await db
    .select({ createdAt: appointments.createdAt })
    .from(appointments)
    .where(gte(appointments.createdAt, since));

  const dateInTz = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

  // Seed every day in the window so the chart has no gaps.
  const counts = new Map<string, number>();
  for (let i = DAILY_WINDOW_DAYS - 1; i >= 0; i--) {
    counts.set(dateInTz(new Date(Date.now() - i * 86_400_000)), 0);
  }
  for (const row of created) {
    const key = dateInTz(row.createdAt);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
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
