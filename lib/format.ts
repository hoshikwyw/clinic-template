/**
 * Shared, memoized date/time formatting.
 *
 * Intl.DateTimeFormat construction is expensive, so formatters are cached by
 * (locale | timeZone | style) and reused. Pages were previously constructing a
 * new formatter on every call — sometimes once per appointment row.
 */

type Style = "short" | "long";

const OPTIONS: Record<Style, Intl.DateTimeFormatOptions> = {
  short: {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  },
  long: {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  },
};

const cache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(
  locale: string,
  timeZone: string,
  style: Style
): Intl.DateTimeFormat {
  const key = `${style}|${locale}|${timeZone}`;
  let fmt = cache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { timeZone, ...OPTIONS[style] });
    cache.set(key, fmt);
  }
  return fmt;
}

/** Format an ISO timestamp in the clinic's timezone. `long` for hero displays. */
export function formatDateTime(
  iso: string,
  locale: string,
  timeZone: string,
  style: Style = "short"
): string {
  return getFormatter(locale, timeZone, style).format(new Date(iso));
}
