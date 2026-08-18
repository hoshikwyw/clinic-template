import type {
  BusinessHours,
  ScheduleBreak,
  ScheduleException,
} from "@config-engine";

/**
 * Pure, timezone-aware slot generation (no external date library).
 *
 * Slots are computed in the clinic's local time (config.locale.timezone) from
 * its business hours + the chosen service's duration, then expressed as UTC
 * instants (ISO) for storage. Library-free via the built-in Intl APIs.
 *
 * The open window is the weekly rectangle (openDays/openTime/closeTime), minus
 * recurring breaks, with dated exceptions overriding a day entirely — see
 * resolveDayWindow.
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

/** "HH:MM" → minutes since local midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
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

/** Clinic-local wall clock for an instant, as minutes since local midnight. */
function localWallMinutes(at: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) map[p.type] = p.value;
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  return hour * 60 + Number(map.minute);
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

/**
 * Convert a clinic-local wall time to the matching UTC instant.
 *
 * Two passes, not one: the first guess uses the offset in force at the *wrong*
 * instant, which is off by an hour for wall times on the far side of a DST
 * transition. Re-reading the offset at the candidate instant and re-applying it
 * converges everywhere except inside a spring-forward gap, where the requested
 * wall time does not exist at all — there the result lands just after the
 * transition, and callers that care should use `wallTimeExists` to skip it.
 *
 * Myanmar (the current sample clinics) has no DST, so this is latent today —
 * but the product is sold as a general template, and a clinic in a DST zone
 * would otherwise get an hour of wrong appointment times twice a year.
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstPass = asUtc - tzOffsetMs(timeZone, new Date(asUtc));
  const secondPass = asUtc - tzOffsetMs(timeZone, new Date(firstPass));
  return new Date(secondPass);
}

/**
 * Does this clinic-local wall time actually exist on this date? False for the
 * hour skipped by a spring-forward transition. (Ambiguous fall-back times exist
 * twice; we take the first, which is the standard convention.)
 */
export function wallTimeExists(
  year: number,
  month: number,
  day: number,
  minutes: number,
  timeZone: string
): boolean {
  const instant = zonedWallTimeToUtc(
    year,
    month,
    day,
    Math.floor(minutes / 60),
    minutes % 60,
    timeZone
  );
  return localWallMinutes(instant, timeZone) === minutes;
}

/** Half-open minute range [start, end) within a local day. */
interface MinuteRange {
  start: number;
  end: number;
}

/**
 * The exception governing a date, if any. Later entries win, so a specific
 * date listed after a range can carve itself out of it.
 */
export function findScheduleException(
  exceptions: ScheduleException[],
  date: string
): ScheduleException | undefined {
  let match: ScheduleException | undefined;
  for (const e of exceptions) {
    if (date >= e.from && date <= (e.to ?? e.from)) match = e;
  }
  return match;
}

/**
 * The open window for one local date, or null when the clinic is shut.
 *
 * Precedence: a dated exception beats the weekly pattern entirely — including
 * opening a day that is not normally an open day, which is how a clinic
 * declares a one-off Saturday clinic. Breaks are recurring facts about the day
 * and still apply inside special hours.
 */
function resolveDayWindow(
  bh: BusinessHours,
  date: string,
  weekday: number
): MinuteRange | null {
  const exception = findScheduleException(bh.exceptions, date);

  if (exception) {
    if (exception.closed) return null;
    // superRefine guarantees both are present when closed is false.
    return {
      start: toMinutes(exception.openTime!),
      end: toMinutes(exception.closeTime!),
    };
  }

  if (!bh.openDays.includes(weekday)) return null;
  return { start: toMinutes(bh.openTime), end: toMinutes(bh.closeTime) };
}

/** Breaks that apply on a given weekday, as minute ranges. */
function breaksFor(breaks: ScheduleBreak[], weekday: number): MinuteRange[] {
  return breaks
    .filter((b) => !b.days || b.days.includes(weekday))
    .map((b) => ({ start: toMinutes(b.startTime), end: toMinutes(b.endTime) }));
}

/** Do two half-open ranges overlap? */
function overlaps(a: MinuteRange, b: MinuteRange): boolean {
  return a.start < b.end && b.start < a.end;
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

  // Walk LOCAL CALENDAR DATES, not 24-hour jumps from `now`. Adding 86_400_000
  // ms repeatedly drifts across a DST boundary and will skip or repeat a local
  // day; incrementing the date parts in UTC is pure calendar arithmetic and has
  // no offset to get wrong.
  const today = localParts(now, timeZone);
  const firstDateMs = Date.UTC(today.year, today.month - 1, today.day);

  const days: DaySlots[] = [];

  for (let i = 0; i < bh.bookingHorizonDays; i++) {
    const cursor = new Date(firstDateMs + i * 86_400_000);
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const day = cursor.getUTCDate();
    const weekday = cursor.getUTCDay();
    const date = `${year}-${pad(month)}-${pad(day)}`;

    const window = resolveDayWindow(bh, date, weekday);
    if (!window) continue;

    const dayBreaks = breaksFor(bh.breaks, weekday);
    const slots: Slot[] = [];

    for (
      let m = window.start;
      m + serviceDurationMinutes <= window.end;
      m += bh.slotMinutes
    ) {
      const span: MinuteRange = { start: m, end: m + serviceDurationMinutes };
      if (dayBreaks.some((b) => overlaps(span, b))) continue;

      // A slot at a wall time that a spring-forward skipped cannot be attended.
      if (!wallTimeExists(year, month, day, m, timeZone)) continue;

      const h = Math.floor(m / 60);
      const mi = m % 60;
      const startUtc = zonedWallTimeToUtc(year, month, day, h, mi, timeZone);
      if (startUtc < minStart) continue;

      const endUtc = new Date(
        startUtc.getTime() + serviceDurationMinutes * 60_000
      );
      slots.push({
        date,
        time: `${pad(h)}:${pad(mi)}`,
        startIso: startUtc.toISOString(),
        endIso: endUtc.toISOString(),
      });
    }

    if (slots.length > 0) {
      // Noon, so the label is immune to any transition at the day's edges.
      const labelInstant = zonedWallTimeToUtc(year, month, day, 12, 0, timeZone);
      const label = new Intl.DateTimeFormat(locale, {
        timeZone,
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(labelInstant);
      days.push({ date, label, slots });
    }
  }

  return days;
}
