import type { SqlDb } from '../log/db';
import { addDays } from '../log/time';
import { mechanicFrictionThreshold, type Signature } from './ladder';

const WINDOW_DAYS = 14;

export interface SignatureContext {
  /** Sealed-day count ÷ calendar days, trailing WINDOW_DAYS ending at the lapse's start. */
  recentSealRate: number;
  /** Same, for the WINDOW_DAYS immediately before that — the baseline recentSealRate is compared against. */
  priorSealRate: number;
  holdCancelRate: number;
  /** reading_start days in the window with no matching seal. */
  opensWithoutSeals: number;
  /** Of the opens, the fraction that never reached scroll_end (stalled mid-chapter). */
  scrollStallRate: number;
  currentBookSealRate: number | null;
  previousBookSealRate: number | null;
  cueStrengthRecent: number | null;
  cueStrengthPrior: number | null;
}

/**
 * §11 — precedence matters: these aren't mutually exclusive in the
 * raw data, so the most mechanical/certain signal is checked first.
 * mechanic_friction is closest to unambiguous (a hard rate
 * threshold); life_disruption's "abrupt onset" is checked next since
 * ladder() already special-cases it; book_fatigue and cue_collapse
 * need a clear prior-period contrast; dose_too_high and drift are the
 * defaults when nothing sharper explains the gap.
 */
export function classifySignature(ctx: SignatureContext): Signature {
  if (mechanicFrictionThreshold(ctx.holdCancelRate)) return 'mechanic_friction';

  if (ctx.priorSealRate >= 0.7 && ctx.recentSealRate === 0) return 'life_disruption';

  if (
    ctx.previousBookSealRate !== null &&
    ctx.currentBookSealRate !== null &&
    ctx.previousBookSealRate >= 0.7 &&
    ctx.currentBookSealRate < 0.4
  ) {
    return 'book_fatigue';
  }

  if (
    ctx.cueStrengthPrior !== null &&
    ctx.cueStrengthRecent !== null &&
    ctx.cueStrengthPrior - ctx.cueStrengthRecent > 0.3
  ) {
    return 'cue_collapse';
  }

  if (ctx.opensWithoutSeals > 0 && ctx.scrollStallRate > 0.5) return 'dose_too_high';

  return 'drift';
}

function sealRateInRange(db: SqlDb, startInclusive: string, endExclusive: string): number | null {
  const calendarDays = Math.round(
    (Date.parse(`${endExclusive}T00:00:00Z`) - Date.parse(`${startInclusive}T00:00:00Z`)) / 86_400_000,
  );
  if (calendarDays <= 0) return null;
  const sealed = db.get<{ c: number }>(
    'SELECT COUNT(*) as c FROM days WHERE sealed = 1 AND local_date >= ? AND local_date < ?',
    [startInclusive, endExclusive],
  );
  return (sealed?.c ?? 0) / calendarDays;
}

/**
 * Queries the log for everything classifySignature() needs, as of a
 * lapse's start (`date` = the day ladder_day transitions to 1 — see
 * steps.ts diagnose(), which computes this once per lapse and carries
 * it forward rather than recomputing against an increasingly empty
 * trailing window as the lapse continues).
 */
export function buildSignatureContext(db: SqlDb, date: string): SignatureContext {
  const windowStart = addDays(date, -WINDOW_DAYS);
  const priorStart = addDays(date, -WINDOW_DAYS * 2);

  const recentSealRate = sealRateInRange(db, windowStart, date) ?? 0;
  const priorSealRate = sealRateInRange(db, priorStart, windowStart) ?? 0;

  const eventCounts = db.get<{ hold_cancels: number; seals: number }>(
    `SELECT
       SUM(CASE WHEN type = 'hold_cancel' THEN 1 ELSE 0 END) as hold_cancels,
       SUM(CASE WHEN type = 'seal' THEN 1 ELSE 0 END) as seals
     FROM events WHERE local_date >= ? AND local_date < ?`,
    [windowStart, date],
  );
  const hcTotal = (eventCounts?.hold_cancels ?? 0) + (eventCounts?.seals ?? 0);
  const holdCancelRate = hcTotal > 0 ? (eventCounts?.hold_cancels ?? 0) / hcTotal : 0;

  const opens = db
    .all<{ local_date: string }>(
      `SELECT DISTINCT local_date FROM events WHERE type = 'reading_start' AND local_date >= ? AND local_date < ?`,
      [windowStart, date],
    )
    .map((r) => r.local_date);
  const scrollEnds = new Set(
    db
      .all<{ local_date: string }>(
        `SELECT DISTINCT local_date FROM events WHERE type = 'scroll_end' AND local_date >= ? AND local_date < ?`,
        [windowStart, date],
      )
      .map((r) => r.local_date),
  );
  const sealedDates = new Set(
    db
      .all<{ local_date: string }>(
        'SELECT local_date FROM days WHERE sealed = 1 AND local_date >= ? AND local_date < ?',
        [windowStart, date],
      )
      .map((r) => r.local_date),
  );
  const opensWithoutSeals = opens.filter((d) => !sealedDates.has(d)).length;
  const stalls = opens.filter((d) => !scrollEnds.has(d)).length;
  const scrollStallRate = opens.length > 0 ? stalls / opens.length : 0;

  const currentBookStart = db.get<{ local_date: string }>(
    `SELECT local_date FROM events WHERE type = 'book_start' AND local_date <= ? ORDER BY local_date DESC, id DESC LIMIT 1`,
    [date],
  );
  let currentBookSealRate: number | null = null;
  let previousBookSealRate: number | null = null;
  if (currentBookStart) {
    currentBookSealRate = sealRateInRange(db, currentBookStart.local_date, date);
    const previousBookStart = db.get<{ local_date: string }>(
      `SELECT local_date FROM events WHERE type = 'book_start' AND local_date < ? ORDER BY local_date DESC, id DESC LIMIT 1`,
      [currentBookStart.local_date],
    );
    if (previousBookStart) {
      previousBookSealRate = sealRateInRange(db, previousBookStart.local_date, currentBookStart.local_date);
    }
  }

  const cueStrength = (windowEnd: string, windowStartDate: string): number | null => {
    const row = db.get<{ sealed: number; before: number }>(
      `SELECT COUNT(*) as sealed, SUM(COALESCE(sealed_before_nudge, 0)) as before
         FROM days WHERE sealed = 1 AND local_date >= ? AND local_date < ?`,
      [windowStartDate, windowEnd],
    );
    if (!row || row.sealed === 0) return null;
    return row.before / row.sealed;
  };

  return {
    recentSealRate,
    priorSealRate,
    holdCancelRate,
    opensWithoutSeals,
    scrollStallRate,
    currentBookSealRate,
    previousBookSealRate,
    cueStrengthRecent: cueStrength(date, windowStart),
    cueStrengthPrior: cueStrength(windowStart, priorStart),
  };
}
