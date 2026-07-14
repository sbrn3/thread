import type { SqlDb } from '../../log/db';
import { nap, randomizationTest } from './nap';

export interface PhaseMetric {
  phase: number;
  arm: 'A' | 'B';
  daysSealed: number;
  disturbed: boolean;
}

export interface ReversalReport {
  expId: string;
  phases: PhaseMetric[];
  meanA: number;
  meanB: number;
  nap: number;
  /** Proportion of label permutations at least as extreme as observed — "exceeds X%" is 1 minus this. */
  randomizationExtremity: number;
  trend: 'none' | 'monotonic';
  consistentDirection: boolean;
  winner: 'A' | 'B' | null;
  confidence: 'strong' | 'weak' | 'inconclusive';
}

/**
 * Per-phase days-sealed, derived purely from exp_phases' date ranges
 * joined against days — no per-event arm-stamping needed. A phase is
 * "disturbed" if any day inside it was flagged by closeDay's confound
 * detection (§13); disturbed phases are reported but excluded from
 * the verdict below.
 */
export function phaseMetrics(db: SqlDb, expId: string): PhaseMetric[] {
  const phases = db.all<{ phase: number; arm: string; start_date: string; end_date: string }>(
    'SELECT phase, arm, start_date, end_date FROM exp_phases WHERE exp_id = ? ORDER BY phase',
    [expId],
  );
  return phases.map((p) => {
    const row = db.get<{ sealed: number; disturbed: number }>(
      `SELECT COALESCE(SUM(sealed), 0) AS sealed, COALESCE(MAX(disturbed), 0) AS disturbed
         FROM days WHERE local_date BETWEEN ? AND ?`,
      [p.start_date, p.end_date],
    );
    return {
      phase: p.phase,
      arm: p.arm as 'A' | 'B',
      daysSealed: row?.sealed ?? 0,
      disturbed: (row?.disturbed ?? 0) === 1,
    };
  });
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Habit formation, not a treatment effect: does the metric rise regardless of arm? */
function detectTrend(phases: PhaseMetric[]): 'none' | 'monotonic' {
  const sorted = [...phases].sort((a, b) => a.phase - b.phase);
  const strictlyRising = sorted.every((p, i) => i === 0 || p.daysSealed >= sorted[i - 1].daysSealed);
  const anyIncrease = sorted.some((p, i) => i > 0 && p.daysSealed > sorted[i - 1].daysSealed);
  return strictlyRising && anyIncrease ? 'monotonic' : 'none';
}

/**
 * "Two-for-two": pairing phases in the order they ran (0↔1, 2↔3 —
 * the two natural A-vs-B comparisons in an ABAB/BABA sequence), does
 * the same arm win both times? Requires all 4 phases undisturbed;
 * with fewer, consistency can't honestly be claimed.
 */
function consistentDirection(phases: PhaseMetric[]): boolean {
  if (phases.length !== 4 || phases.some((p) => p.disturbed)) return false;
  const sorted = [...phases].sort((a, b) => a.phase - b.phase);
  const winnerOf = (x: PhaseMetric, y: PhaseMetric): 'A' | 'B' | null =>
    x.daysSealed === y.daysSealed ? null : x.daysSealed > y.daysSealed ? x.arm : y.arm;
  const first = winnerOf(sorted[0], sorted[1]);
  const second = winnerOf(sorted[2], sorted[3]);
  return first !== null && first === second;
}

export function analyzeReversal(db: SqlDb, expId: string): ReversalReport | null {
  const all = phaseMetrics(db, expId);
  const usable = all.filter((p) => !p.disturbed);
  const aVals = usable.filter((p) => p.arm === 'A').map((p) => p.daysSealed);
  const bVals = usable.filter((p) => p.arm === 'B').map((p) => p.daysSealed);
  if (aVals.length === 0 || bVals.length === 0) return null; // not enough undisturbed data yet

  const meanA = mean(aVals);
  const meanB = mean(bVals);
  const napValue = nap(aVals, bVals);
  const extremity = randomizationTest(usable.map((p) => ({ arm: p.arm, value: p.daysSealed })));
  const trend = detectTrend(all);
  const consistent = consistentDirection(all);
  const winner = meanA === meanB ? null : meanA > meanB ? 'A' : 'B';

  // §15: strong requires clean separation (NAP), a randomization result
  // as extreme as this test can possibly produce, agreement between
  // the two natural phase comparisons, and no confounding drift. Any
  // one missing caps it at weak; a trend or a near-chance NAP is
  // inconclusive.
  //
  // With exactly 4 phases (2 A, 2 B) there are only 6 distinct ways to
  // split them into two pairs — and the complement of the observed
  // split (swap which pair is "A") always ties it for most extreme,
  // since a two-sided |mean difference| is symmetric under that swap.
  // So the floor this test can ever reach is 2/6 = 1/3, not something
  // smaller; requiring less than that would make "strong" impossible
  // to award under any circumstances, ever.
  let confidence: ReversalReport['confidence'] = 'inconclusive';
  const separated = napValue >= 0.75 || napValue <= 0.25;
  const surprising = extremity <= 1 / 3 + 1e-9; // as extreme as this test can distinguish at n=4
  if (trend === 'none' && separated && surprising && consistent) {
    confidence = 'strong';
  } else if (trend === 'none' && (separated || surprising)) {
    confidence = 'weak';
  }

  return { expId, phases: all, meanA, meanB, nap: napValue, randomizationExtremity: extremity, trend, consistentDirection: consistent, winner, confidence };
}
