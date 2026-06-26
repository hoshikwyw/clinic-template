import type { BusinessHours } from "@config-engine";

/**
 * Pure, timezone-aware slot generation (no external date library).
 *
 * Slots are computed in the clinic's local time (config.locale.timezone) from
 * its business hours + the chosen service's duration, then expressed as UTC
 * instants (ISO) for storage. Library-free via the built-in Intl APIs.
 */

export interface Slot {
  /** clinic-local date, "YYYY-MM-DD" */
  date: string;
  /** clinic-local start time, "HH:MM" */
  time: string;
  /** UTC instant ISO for storage / comparison */
  startIso: string;
  endIso: string;
}

export interface DaySlots {
  date: string;
  /** e.g. "Mon, 30 Jun" */
  label: string;
  slots: Slot[];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Clinic-local calendar parts for an instant. weekday: 0=Sun…6=Sat. */
function localParts(at: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) map[p.type] = p.value;
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: weekdays[map.weekday],
  };
}

/** Offset (ms) between the given timeZone and UTC at a moment. */
function tzOffsetMs(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) map[p.type] = p.value;
  const hour = map.hour === "24" ? "00" : map.hour;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(hour),
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - at.getTime();
}

/** Convert a clinic-local wall time to the matching UTC instant. */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = tzOffsetMs(timeZone, new Date(guess));
  return new Date(guess - offset);
}

export interface GenerateSlotsOptions {
  businessHours: BusinessHours;
  serviceDurationMinutes: number;
  timeZone: string;
  leadTimeHours: number;
  /** locale for the human-readable day label (defaults to en-GB) */
  locale?: string;
  now?: Date;
}

/** Generate open slots per day across the booking horizon. */
export function generateDaySlots(opts: GenerateSlotsOptions): DaySlots[] {
  const {
    businessHours: bh,
    serviceDurationMinutes,
    timeZone,
    leadTimeHours,
    locale = "en-GB",
    now = new Date(),
  } = opts;

  const minStart = new Date(now.getTime() + leadTimeHours * 3_600_000);
  const [openH, openM] = bh.openTime.split(":").map(Number);
  const [closeH, closeM] = bh.closeTime.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const days: DaySlots[] = [];

  for (let i = 0; i < bh.bookingHorizonDays; i++) {
    const dayInstant = new Date(now.getTime() + i * 86_400_000);
    const lp = localParts(dayInstant, timeZone);
    if (!bh.openDays.includes(lp.weekday)) continue;

    const slots: Slot[] = [];
    for (
      let m = openMinutes;
      m + serviceDurationMinutes <= closeMinutes;
      m += bh.slotMinutes
    ) {
      const h = Math.floor(m / 60);
      const mi = m % 60;
      const startUtc = zonedWallTimeToUtc(lp.year, lp.month, lp.day, h, mi, timeZone);
      if (startUtc < minStart) continue;
      const endUtc = new Date(startUtc.getTime() + serviceDurationMinutes * 60_000);
      slots.push({
        date: `${lp.year}-${pad(lp.month)}-${pad(lp.day)}`,
        time: `${pad(h)}:${pad(mi)}`,
        startIso: startUtc.toISOString(),
        endIso: endUtc.toISOString(),
      });
    }

    if (slots.length > 0) {
      const labelInstant = zonedWallTimeToUtc(lp.year, lp.month, lp.day, 12, 0, timeZone);
      const label = new Intl.DateTimeFormat(locale, {
        timeZone,
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(labelInstant);
      days.push({ date: `${lp.year}-${pad(lp.month)}-${pad(lp.day)}`, label, slots });
    }
  }

  return days;
}
