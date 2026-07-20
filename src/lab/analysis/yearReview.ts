import type { SqlDb } from '../../log/db';
import { addDays, datesBetween } from '../../log/time';
import { srbaiTrend, type SrbaiTrendPoint } from '../srbai';

export interface RecoveryStats {
  episodes: number; // gaps of 2+ days between sealed days
  recoveredWithin7: number;
  recoveryRate: number; // 1 when there are no episodes at all — nothing to recover from
}

/**
 * §12 R6 "recovery rate" — of the gaps of 2+ days between sealed
 * days (single misses aren't lapses needing recovery), the fraction
 * that resolved within 7 days: the same boundary the ladder itself
 * uses for its one_question tier, i.e. "recovered before reaching
 * the offramp stage."
 */
export function computeRecoveryRate(db: SqlDb): RecoveryStats {
  const sealedDates = db
    .all<{ local_date: string }>('SELECT local_date FROM days WHERE sealed = 1 ORDER BY local_date')
    .map((r) => r.local_date);

  let episodes = 0;
  let recovered = 0;
  for (let i = 1; i < sealedDates.length; i++) {
    const gap = datesBetween(sealedDates[i - 1], sealedDates[i]).length;
    if (gap >= 2) {
      episodes++;
      if (gap <= 7) recovered++;
    }
  }
  return { episodes, recoveredWithin7: recovered, recoveryRate: episodes > 0 ? recovered / episodes : 1 };
}

export interface YearReviewReport {
  daysSealed: number;
  totalDays: number;
  hollowness: { promoted: number; held60: number };
  srbaiTrend: SrbaiTrendPoint[];
  cueStrengthEarly: number | null;
  cueStrengthRecent: number | null;
  recovery: RecoveryStats;
  verdict: string;
}

function verdictFor(r: Omit<YearReviewReport, 'verdict'>): string {
  const sealRate = r.totalDays > 0 ? r.daysSealed / r.totalDays : 0;
  const behaviourUp = sealRate >= 0.5;

  const srbaiValues = r.srbaiTrend.map((p) => p.average);
  const srbaiRising = srbaiValues.length >= 2 && srbaiValues[srbaiValues.length - 1] > srbaiValues[0];
  const srbaiFlat = srbaiValues.length >= 2 && Math.abs(srbaiValues[srbaiValues.length - 1] - srbaiValues[0]) < 0.5;

  const retentionNearZero = r.hollowness.promoted > 0 && r.hollowness.held60 === 0;

  if (!behaviourUp) {
    return 'The habit did not take hold this year — sealed days stayed below half. That is the finding, not a failure to report honestly.';
  }
  if (retentionNearZero) {
    return 'Behaviour is up, but retention is near zero: the reading was happening, but it was not doing its job. Worth changing what "reading" means before changing how often it happens.';
  }
  if (srbaiFlat || !srbaiRising) {
    return 'Behaviour is up, but SRBAI is flat: this looks like compliance, not a habit yet. The scaffolding (cue, nudge, floor) is still load-bearing.';
  }
  return 'A habit formed: behaviour is up, SRBAI is rising, and retention held. This sets the starting dose for year-2 titration.';
}

/** §12 R6 "the year" (day 365) — everything, including whether the app is no longer needed. */
export function buildYearReview(db: SqlDb, today: string, trialStart: string): YearReviewReport {
  const totalDays = datesBetween(trialStart, today).length;
  const daysSealed =
    db.get<{ c: number }>('SELECT COUNT(*) as c FROM days WHERE sealed = 1 AND local_date >= ? AND local_date <= ?', [
      trialStart,
      today,
    ])?.c ?? 0;

  const promoted = db.get<{ c: number }>('SELECT COUNT(*) as c FROM passages WHERE promoted_at IS NOT NULL')?.c ?? 0;
  const held60 =
    db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM passages
       WHERE promoted_at IS NOT NULL AND held_since IS NOT NULL
         AND julianday(?) - julianday(held_since) >= 60`,
      [today],
    )?.c ?? 0;

  const trend = srbaiTrend(db);
  const cueStrengthEarly = computeCueStrengthAt(db, addDays(trialStart, 30));
  const cueStrengthRecent = computeCueStrengthAt(db, today);
  const recovery = computeRecoveryRate(db);

  const base = {
    daysSealed,
    totalDays,
    hollowness: { promoted, held60 },
    srbaiTrend: trend,
    cueStrengthEarly,
    cueStrengthRecent,
    recovery,
  };
  return { ...base, verdict: verdictFor(base) };
}

function computeCueStrengthAt(db: SqlDb, asOf: string): number | null {
  const row = db.get<{ sealed: number; before: number }>(
    `SELECT COUNT(*) AS sealed, SUM(COALESCE(sealed_before_nudge, 0)) AS before
       FROM days WHERE sealed = 1 AND local_date <= ? AND local_date > date(?, '-30 days')`,
    [asOf, asOf],
  );
  if (!row || row.sealed === 0) return null;
  return row.before / row.sealed;
}

const R6_DAY = 365;

/** Due exactly once, the first reconcile on or after day 365 of the trial. */
export function isYearReviewDue(db: SqlDb, today: string, trialStart: string, alreadyShown: boolean): boolean {
  if (alreadyShown) return false;
  return datesBetween(trialStart, today).length >= R6_DAY;
}
