import { describe, expect, it } from 'vitest';
import { Log, meta } from '../src/log/log';
import { migrate } from '../src/log/schema';
import { logicalDate } from '../src/log/time';
import type { AppEvent } from '../src/log/types';
import { openTestDb } from './util/testDb';

function setup(now?: () => number) {
  const db = openTestDb();
  migrate(db);
  const log = new Log({ db, buildSha: 'test-sha', now });
  return { db, log };
}

describe('Log.write (W1)', () => {
  it('an event written on one launch is queryable on the next', () => {
    const ts = Date.UTC(2026, 6, 14, 12, 0, 0);
    const { db, log } = setup(() => ts);
    log.write({ type: 'app_open' });

    // "next launch": a fresh Log over the same db
    const again = new Log({ db, buildSha: 'test-sha' });
    const events = again.eventsOn(logicalDate(ts));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('app_open');
  });

  it('stamps ts, tz_offset, local_date and build_sha — callers cannot lie', () => {
    const ts = Date.UTC(2026, 6, 14, 12, 0, 0);
    const { db, log } = setup(() => ts);
    // EventInput's type forbids these fields; verify the stamp lands anyway.
    log.write({ type: 'seal', book: 'John', chapter: 3, before_nudge: 1 });

    const row = db.get<AppEvent>('SELECT * FROM events')!;
    expect(row.ts).toBe(ts);
    expect(row.build_sha).toBe('test-sha');
    expect(row.local_date).toBe(logicalDate(ts));
    expect(typeof row.tz_offset).toBe('number');
  });

  it('rebuildDays derives sealed days from events (days is rebuildable)', () => {
    const ts = Date.UTC(2026, 6, 14, 12, 0, 0);
    const { db, log } = setup(() => ts);
    const date = logicalDate(ts);
    log.write({ type: 'reading_start', book: 'John', chapter: 3 });
    log.write({ type: 'seal', book: 'John', chapter: 3, before_nudge: 1 });
    log.rebuildDays('2026-01-01');

    const days = log.daysBetween(date, date);
    expect(days).toHaveLength(1);
    expect(days[0].sealed).toBe(1);
    expect(days[0].sealed_before_nudge).toBe(1);
    expect(days[0].book).toBe('John');

    // rebuild is idempotent
    log.rebuildDays('2026-01-01');
    expect(db.all('SELECT * FROM days')).toHaveLength(1);
  });

  it('meta get/set round-trips (watermark discipline)', () => {
    const { db } = setup();
    expect(meta.get(db, 'watermark')).toBeNull();
    meta.set(db, 'watermark', '2026-07-14');
    meta.set(db, 'watermark', '2026-07-15');
    expect(meta.get(db, 'watermark')).toBe('2026-07-15');
  });
});
