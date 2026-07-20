import type { SqlDb } from '../../log/db';
import { addDays } from '../../log/time';

const ARM_VERSES: Record<string, number> = { v10: 10, v20: 20, v30: 30, v45: 45 };
const GRADE_SCORE: Record<string, number> = { held: 1, partial: 0.5, lost: 0, skipped: 0.5 };

export interface DoseCurvePoint {
  arm: string;
  targetVerses: number;
  n: number;
  sealRate: number;
  recallScore: number; // mean probe-grade score, 0-1, for probes fired the day after
  composite: number; // sealRate * recallScore — E14's actual optimization target
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}

/**
 * §14 E10 "dose curve fit" — composite = recall_score × seal_rate,
 * per arm, from the raw days/probes tables (not decisions.reward,
 * which only carries the single-day sealed signal — this needs the
 * next-day recall probe too). Arms with no assigned days yet return
 * zeroed placeholders rather than being omitted, so a caller can
 * always show all four candidate doses.
 */
export function analyzeDoseCurve(db: SqlDb): DoseCurvePoint[] {
  return Object.entries(ARM_VERSES).map(([arm, targetVerses]) => {
    const dates = db
      .all<{ local_date: string }>(`SELECT local_date FROM decisions WHERE point = 'dose_target' AND arm = ?`, [arm])
      .map((r) => r.local_date);
    const n = dates.length;
    if (n === 0) return { arm, targetVerses, n: 0, sealRate: 0, recallScore: 0, composite: 0 };

    const sealed = db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM days WHERE sealed = 1 AND local_date IN (${placeholders(n)})`,
      dates,
    );
    const sealRate = (sealed?.c ?? 0) / n;

    // The recall signal for a dose assigned on date D is the probe
    // fired on D+1 (E9 probes yesterday's reading).
    const nextDayDates = dates.map((d) => addDays(d, 1));
    const grades = db.all<{ grade: string }>(
      `SELECT grade FROM probes WHERE fired = 1 AND grade IS NOT NULL AND local_date IN (${placeholders(n)})`,
      nextDayDates,
    );
    const recallScore =
      grades.length > 0 ? grades.reduce((sum, g) => sum + (GRADE_SCORE[g.grade] ?? 0), 0) / grades.length : 0;

    return { arm, targetVerses, n, sealRate, recallScore, composite: sealRate * recallScore };
  });
}

/** The peak of the curve — null if no arm has any assigned days yet. */
export function bestDoseArm(points: DoseCurvePoint[]): DoseCurvePoint | null {
  const withEvidence = points.filter((p) => p.n > 0);
  if (withEvidence.length === 0) return null;
  return withEvidence.reduce((best, p) => (p.composite > best.composite ? p : best));
}
