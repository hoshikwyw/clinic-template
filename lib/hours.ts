/**
 * Compact a list of open weekdays into readable ranges, e.g. [1,2,3,4,5] →
 * "Mon–Fri", using the provided localized day names (index 0 = Sunday).
 */
export function formatOpenDays(days: number[], dayNames: string[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    parts.push(
      start === prev ? dayNames[start] : `${dayNames[start]}–${dayNames[prev]}`
    );
    start = sorted[i];
    prev = sorted[i];
  }
  return parts.join(", ");
}
