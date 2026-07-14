import type { SqlDb, SqlParam } from './db';
import type { AppEvent, Day, EventInput } from './types';
import { logicalDate, tzOffsetMinutes } from './time';

export interface LogDeps {
  db: SqlDb;
  buildSha: string;
  now?: () => number; // injectable for tests and simulation
}

// §13.3 /src/log contract. events is append-only: this module exposes
// no UPDATE and no DELETE, and nothing else in the app touches the
// table directly.
export class Log {
  private readonly db: SqlDb;
  private readonly buildSha: string;
  private readonly now: () => number;

  constructor({ db, buildSha, now = Date.now }: LogDeps) {
    this.db = db;
    this.buildSha = buildSha;
    this.now = now;
  }

  /** ts / tz_offset / local_date / build_sha stamped here. Callers cannot lie. */
  write(e: EventInput): void {
    const ts = this.now();
    this.db.run(
      `INSERT INTO events
        (ts, tz_offset, local_date, type, book, chapter, sitting,
         duration_ms, scroll_pct, before_nudge, exp_id, exp_arm, build_sha)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ts,
        tzOffsetMinutes(ts),
        logicalDate(ts),
        e.type,
        e.book ?? null,
        e.chapter ?? null,
        e.sitting ?? null,
        e.duration_ms ?? null,
        e.scroll_pct ?? null,
        e.before_nudge ?? null,
        e.exp_id ?? null,
        e.exp_arm ?? null,
        this.buildSha,
      ] satisfies SqlParam[],
    );
  }

  eventsOn(date: string): AppEvent[] {
    return this.db.all<AppEvent>(
      'SELECT * FROM events WHERE local_date = ? ORDER BY ts, id',
      [date],
    );
  }

  daysBetween(a: string, b: string): Day[] {
    return this.db.all<Day>(
      'SELECT * FROM days WHERE local_date BETWEEN ? AND ? ORDER BY local_date',
      [a, b],
    );
  }

  /**
   * days is derived; it can always be recomputed from events (§13.2).
   * Wraps repeated deriveDayRow() calls in one transaction. reconcile()'s
   * closeDay (W7) calls deriveDayRow() directly instead, since it
   * already owns an outer transaction per day.
   */
  rebuildDays(from: string, to = '9999-12-31'): void {
    this.db.tx(() => {
      const dates = this.db.all<{ local_date: string }>(
        'SELECT DISTINCT local_date FROM events WHERE local_date >= ? AND local_date <= ? ORDER BY local_date',
        [from, to],
      );
      for (const { local_date } of dates) deriveDayRow(this.db, this, local_date);
    });
  }
}

/**
 * Derives one days row from that date's events — no transaction of
 * its own, so callers control atomicity (rebuildDays wraps a batch;
 * reconcile's closeDay relies on its own per-day transaction).
 */
export function deriveDayRow(db: SqlDb, log: Log, date: string): void {
  const events = log.eventsOn(date);
  const seal = events.find((e) => e.type === 'seal');
  const reading = events.find((e) => e.type === 'reading_start') ?? seal;
  db.run(
    `INSERT INTO days
       (local_date, sealed, sealed_before_nudge, book, chapter, sitting,
        dose, exp_id, exp_arm, disturbed, build_sha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(local_date) DO UPDATE SET
       sealed = excluded.sealed,
       sealed_before_nudge = excluded.sealed_before_nudge,
       book = excluded.book,
       chapter = excluded.chapter,
       sitting = excluded.sitting,
       exp_id = excluded.exp_id,
       exp_arm = excluded.exp_arm`,
    [
      date,
      seal ? 1 : 0,
      seal ? (seal.before_nudge ?? 1) : null,
      reading?.book ?? null,
      reading?.chapter ?? null,
      reading?.sitting ?? null,
      'full_chapter',
      seal?.exp_id ?? null,
      seal?.exp_arm ?? null,
      seal?.build_sha ?? null,
    ],
  );
}

// meta helpers — watermark, trial seed, dose, dormancy (§13.2)
export const meta = {
  get(db: SqlDb, key: string): string | null {
    return db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key])?.value ?? null;
  },
  set(db: SqlDb, key: string, value: string): void {
    db.run(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  },
};
