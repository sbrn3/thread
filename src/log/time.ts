import { formatInTimeZone } from 'date-fns-tz';

// Day boundary (§06): a "day" ends at 4:00 AM local, not midnight.
// Reading at 12:40 AM counts for the day that just ended. Hard-coded;
// not user-configurable.
export const DAY_BOUNDARY_HOUR = 4;
const BOUNDARY_MS = DAY_BOUNDARY_HOUR * 60 * 60 * 1000;

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** 'YYYY-MM-DD' the given instant counts for, honouring the 4 AM boundary. */
export function logicalDate(ts: number, timeZone: string = deviceTimeZone()): string {
  return formatInTimeZone(new Date(ts - BOUNDARY_MS), timeZone, 'yyyy-MM-dd');
}

export function logicalToday(now: () => number = Date.now): string {
  return logicalDate(now());
}

/** Device UTC offset in minutes at the given instant (east-positive). */
export function tzOffsetMinutes(ts: number): number {
  return -new Date(ts).getTimezoneOffset();
}

/**
 * §19 invariant 5 — re-derives the logical date from a stored
 * `ts`/`tz_offset` pair directly (no IANA zone lookup, no dependence
 * on the device's CURRENT timezone), so a past event can be checked
 * for internal consistency even if the device has since travelled.
 * Mathematically the same operation logicalDate() does via
 * formatInTimeZone — offset the instant, then read UTC calendar
 * fields — just fed a raw offset instead of a zone name.
 */
export function logicalDateFromOffset(ts: number, tzOffsetMin: number): string {
  const localMs = ts + tzOffsetMin * 60_000 - BOUNDARY_MS;
  return new Date(localMs).toISOString().slice(0, 10);
}

/** Calendar dates after `fromExclusive` up to and including `toInclusive`. */
export function datesBetween(fromExclusive: string, toInclusive: string): string[] {
  const out: string[] = [];
  let cursor = fromExclusive;
  // Walk in UTC so DST transitions cannot skip or repeat a date.
  while (cursor < toInclusive) {
    const next = new Date(Date.parse(`${cursor}T00:00:00Z`) + 24 * 60 * 60 * 1000);
    cursor = next.toISOString().slice(0, 10);
    out.push(cursor);
  }
  return out;
}

export function addDays(date: string, days: number): string {
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + days * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}
