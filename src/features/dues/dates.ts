// Local-time date helpers for Postgres `date` columns (YYYY-MM-DD). Pure, no RN imports.

export const DAY_MS = 86_400_000;

/** Parses 'YYYY-MM-DD' (or a full ISO timestamp) into a local-midnight Date. */
export function parseISODate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return startOfDay(new Date(s));
}

export function toISODate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Date in the given month with the day clamped to the month's length (31 -> 28/29/30). */
export function dateWithDay(year: number, month: number, day: number) {
  const first = new Date(year, month, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(day, last));
}

/** Adds months keeping `anchorDay` (defaults to d's day), clamped to month length. */
export function addMonths(d: Date, n: number, anchorDay = d.getDate()) {
  return dateWithDay(d.getFullYear(), d.getMonth() + n, anchorDay);
}

/** Whole calendar days from a to b (b - a). */
export function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

/** First date with day-of-month `day` on or after `from`. */
export function nextDayOfMonth(day: number, from: Date) {
  const today = startOfDay(from);
  const thisMonth = dateWithDay(today.getFullYear(), today.getMonth(), day);
  return thisMonth >= today ? thisMonth : dateWithDay(today.getFullYear(), today.getMonth() + 1, day);
}
