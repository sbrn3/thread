import type { SqlDb } from '../log/db';
import type { Log } from '../log/log';

// §08 — the notification is NOT the cue. The anchor event is the cue;
// the notification is a safety net. §13.3 contract.

export interface Cue {
  anchor: string; // "my morning coffee"
  place: string; // "the armchair by the window"
  nudgeHour: number; // 0–23, the backup hour
}

export class CueService {
  constructor(
    private readonly db: SqlDb,
    private readonly log: Log,
  ) {}

  current(): Cue | null {
    const row = this.db.get<{ anchor: string; place: string; nudge_hour: number }>(
      'SELECT anchor, place, nudge_hour FROM cue WHERE active = 1 ORDER BY id DESC LIMIT 1',
    );
    return row ? { anchor: row.anchor, place: row.place, nudgeHour: row.nudge_hour } : null;
  }

  /** Writes cue_changed → the lab flags the active phase disturbed (§09). */
  set(c: Cue, now: () => number = Date.now): void {
    this.db.tx(() => {
      this.db.run('UPDATE cue SET active = 0 WHERE active = 1');
      this.db.run(
        'INSERT INTO cue (anchor, place, nudge_hour, set_at, active) VALUES (?, ?, ?, ?, 1)',
        [c.anchor, c.place, c.nudgeHour, now()],
      );
    });
    this.log.write({ type: 'cue_changed' });
  }

  /**
   * §08 primary health metric:
   * cue_strength = days sealed BEFORE the nudge fired ÷ total days sealed.
   */
  strength(windowDays: number, today: string): number | null {
    const row = this.db.get<{ sealed: number; before: number }>(
      `SELECT COUNT(*) AS sealed,
              SUM(COALESCE(sealed_before_nudge, 0)) AS before
         FROM days
        WHERE sealed = 1 AND local_date > date(?, '-' || ? || ' days')`,
      [today, windowDays],
    );
    if (!row || row.sealed === 0) return null;
    return row.before / row.sealed;
  }
}
