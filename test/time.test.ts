import { describe, expect, it } from 'vitest';
import { addDays, datesBetween, logicalDate } from '../src/log/time';

const NY = 'America/New_York';

describe('4 AM day boundary (§06)', () => {
  it('12:40 AM counts for the day that just ended', () => {
    // 2026-07-14 00:40 in New York = 04:40 UTC (EDT, UTC-4)
    const ts = Date.UTC(2026, 6, 14, 4, 40);
    expect(logicalDate(ts, NY)).toBe('2026-07-13');
  });

  it('4:01 AM counts for the new day', () => {
    const ts = Date.UTC(2026, 6, 14, 8, 1); // 04:01 EDT
    expect(logicalDate(ts, NY)).toBe('2026-07-14');
  });

  it('is exact at the boundary: 3:59 → previous day, 4:00 → new day', () => {
    expect(logicalDate(Date.UTC(2026, 6, 14, 7, 59), NY)).toBe('2026-07-13');
    expect(logicalDate(Date.UTC(2026, 6, 14, 8, 0), NY)).toBe('2026-07-14');
  });

  it('survives the DST fall-back night (Nov 1 2026, US)', () => {
    // 01:30 EDT (05:30 UTC) and the repeated 01:30 EST (06:30 UTC)
    // both fall before 4 AM → both count for Oct 31.
    expect(logicalDate(Date.UTC(2026, 10, 1, 5, 30), NY)).toBe('2026-10-31');
    expect(logicalDate(Date.UTC(2026, 10, 1, 6, 30), NY)).toBe('2026-10-31');
    // 05:00 EST is past the boundary → Nov 1.
    expect(logicalDate(Date.UTC(2026, 10, 1, 10, 0), NY)).toBe('2026-11-01');
  });

  it('respects an explicit non-device timezone', () => {
    const ts = Date.UTC(2026, 6, 14, 1, 0); // 10:00 in Tokyo, 21:00 (Jul 13) in NY
    expect(logicalDate(ts, 'Asia/Tokyo')).toBe('2026-07-14');
    expect(logicalDate(ts, NY)).toBe('2026-07-13');
  });
});

describe('date arithmetic', () => {
  it('datesBetween is exclusive-from, inclusive-to', () => {
    expect(datesBetween('2026-07-10', '2026-07-13')).toEqual([
      '2026-07-11',
      '2026-07-12',
      '2026-07-13',
    ]);
    expect(datesBetween('2026-07-13', '2026-07-13')).toEqual([]);
  });

  it('crosses month and DST boundaries without skipping a date', () => {
    const dates = datesBetween('2026-10-30', '2026-11-02');
    expect(dates).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('addDays matches the Leitner intervals use-case', () => {
    expect(addDays('2026-07-14', 1)).toBe('2026-07-15');
    expect(addDays('2026-07-14', 60)).toBe('2026-09-12');
  });
});
