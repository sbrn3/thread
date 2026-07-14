import type { SqlDb } from '../../log/db';
import { PHASE_DAYS, PHASES_PER_EXPERIMENT } from '../phases';
import { REVERSAL_QUEUE } from '../registry';
import { analyzeReversal } from './reversal';
import type { MrtReport } from './mrt';
import type { ReversalReport } from './reversal';

// Presentation-only labels for the three reversal experiments already
// wired end-to-end (§10). Purely cosmetic — the analysis itself
// never depends on knowing what A/B mean.
const ARM_LABELS: Record<string, { A: string; B: string; name: string }> = {
  E1: { A: 'Hold', B: 'Tap', name: 'HOLD-TO-SEAL' },
  E3: { A: 'Visible', B: 'Hidden', name: 'STREAK VISIBILITY' },
  E4: { A: 'Full chapter', B: 'One verse', name: 'COMPLETION FLOOR' },
};

const RECOMMENDATION_TEMPLATES: Record<string, { A: string; B: string }> = {
  E1: {
    A: 'Keep the hold-to-seal ritual — it earns its friction.',
    B: 'Replace hold-to-seal with a single tap.',
  },
  E3: {
    A: 'Show the streak count in the weave.',
    B: 'Keep the streak hidden — the cloth stays a mirror, not a scoreboard.',
  },
  E4: {
    A: 'Keep the full-chapter completion floor.',
    B: 'Lower the floor — any reading counts toward sealing the day.',
  },
};

function recommendationFor(r: ReversalReport): string {
  if (!r.winner) return 'No change — the two conditions performed about the same.';
  return RECOMMENDATION_TEMPLATES[r.expId]?.[r.winner] ?? `Adopt arm ${r.winner} for ${r.expId}.`;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * §15 report anatomy: a verdict, a confidence level, and one concrete
 * change the app is asking permission to make — never a dashboard.
 */
export function renderReversalReport(r: ReversalReport): string {
  const labels = ARM_LABELS[r.expId] ?? { A: 'A', B: 'B', name: r.expId };
  const disturbedCount = r.phases.filter((p) => p.disturbed).length;
  const winnerLabel = r.winner === 'A' ? labels.A : r.winner === 'B' ? labels.B : null;
  const loserLabel = r.winner === 'A' ? labels.B : r.winner === 'B' ? labels.A : null;

  return [
    `EXPERIMENT ${r.expId} · ${labels.name} · randomized reversal`,
    `${r.phases.length * PHASE_DAYS} days · ${r.phases.length} phases` +
      (disturbedCount ? ` · ${disturbedCount} flagged disturbed` : ''),
    '',
    `VERDICT       ${winnerLabel ? `${winnerLabel} outperformed ${loserLabel}.` : 'No difference detected.'}`,
    `EFFECT        ${labels.A} ${r.meanA.toFixed(1)} days/phase · ${labels.B} ${r.meanB.toFixed(1)} days/phase · NAP ${r.nap.toFixed(2)}`,
    `RANDOMIZATION Observed gap exceeds ${Math.round((1 - r.randomizationExtremity) * 100)}% of label permutations.`,
    `TREND         ${r.trend === 'monotonic' ? 'Rising regardless of arm — likely habit formation, not a treatment effect.' : 'No underlying drift detected.'}`,
    `CONFIDENCE    ${titleCase(r.confidence)}.`,
  ].join('\n');
}

export function renderMrtReport(r: MrtReport): string {
  const overallLine = r.overall.map((a) => `${a.arm} ${(a.rewardRate * 100).toFixed(0)}% (n=${a.n})`).join(' · ');
  return [
    `MRT ${r.point} · ${r.overall.reduce((s, a) => s + a.n, 0)} decision points`,
    '',
    `PROXIMAL EFFECT  ${overallLine}`,
    `CONFIDENCE       ${titleCase(r.confidence)}. Moderator splits are exploratory — never reported as strong (§15).`,
  ].join('\n');
}

/**
 * Reports surface once (§15) — an existing `applied` response is
 * never overwritten by regenerating the same experiment's report.
 */
export function saveReversalReport(db: SqlDb, r: ReversalReport, recommendation: string, now: () => number = Date.now): void {
  db.run(
    `INSERT INTO reports (exp_id, generated_at, verdict, effect, nap, confidence, recommendation, applied, report_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(exp_id) DO UPDATE SET
       generated_at = excluded.generated_at, verdict = excluded.verdict, effect = excluded.effect,
       nap = excluded.nap, confidence = excluded.confidence, recommendation = excluded.recommendation,
       report_text = excluded.report_text`,
    [r.expId, now(), r.winner ?? 'none', r.meanA - r.meanB, r.nap, r.confidence, recommendation, null, renderReversalReport(r)],
  );
}

/**
 * §15 "the engine can be overruled": logs the user's response and
 * never re-asks. Advises; does not govern.
 */
export function markApplied(db: SqlDb, expId: string, applied: boolean): void {
  db.run('UPDATE reports SET applied = ? WHERE exp_id = ?', [applied ? 1 : 0, expId]);
}

export interface PendingReport {
  expId: string;
  recommendation: string;
  reportText: string;
}

/** Reports surface once, after a seal (§15) — one not yet responded to, if any. */
export function getPendingReport(db: SqlDb): PendingReport | null {
  const row = db.get<{ exp_id: string; recommendation: string; report_text: string }>(
    'SELECT exp_id, recommendation, report_text FROM reports WHERE applied IS NULL ORDER BY generated_at ASC LIMIT 1',
  );
  return row ? { expId: row.exp_id, recommendation: row.recommendation, reportText: row.report_text } : null;
}

/**
 * §13.4's reconcile() calls this after the day loop (`maybeSurfaceReport`).
 * Reversal experiments only: a report generates once, the day the 4th
 * phase finishes, and never again for that experiment. MRT reports
 * (E5/E6) are deliberately NOT auto-generated here — the plan surfaces
 * those at review checkpoints, not continuously, since a live-updating
 * effect estimate is itself an invitation to outcome-watch (§15). A
 * future review-checkpoint feature calls analyzeMrt/renderMrtReport
 * directly.
 */
export function maybeGenerateReports(db: SqlDb, now: () => number = Date.now): void {
  for (const expId of REVERSAL_QUEUE) {
    const alreadyReported = db.get('SELECT 1 FROM reports WHERE exp_id = ?', [expId]);
    if (alreadyReported) continue;

    const finished = db.get(
      `SELECT 1 FROM exp_phases WHERE exp_id = ? AND phase = ? AND status = 'done'`,
      [expId, PHASES_PER_EXPERIMENT - 1],
    );
    if (!finished) continue;

    const report = analyzeReversal(db, expId);
    if (!report) continue; // all phases were disturbed — nothing usable to report yet

    saveReversalReport(db, report, recommendationFor(report), now);
  }
}
