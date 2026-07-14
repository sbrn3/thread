import { deriveDayRow, meta } from '../log/log';
import { addDays } from '../log/time';
import type { ReconcileContext, ReconcileSteps } from './reconcile';
import { PHASES_PER_EXPERIMENT, PHASE_DAYS, phaseArm } from './phases';
import type { Signature } from './ladder';

/** 1. Derive the days row for this date from its events — no transaction of its own (reconcile owns one per day). */
export function closeDay(ctx: ReconcileContext, date: string): void {
  deriveDayRow(ctx.db, ctx.log, date);
}

/**
 * 2. Fill decisions.reward for nudge_hour decisions on this date.
 * Proximal outcome: sealed that day. Only touches rows already marked
 * delivered=1 — and nothing sets that flag yet (it requires a live
 * notification-received listener, a device-level piece not built in
 * this pass). Correct now, genuinely inert until that listener exists;
 * not a stub, since the semantics are real and won't need revisiting.
 */
export function attributeRewards(ctx: ReconcileContext, date: string): void {
  const day = ctx.db.get<{ sealed: number }>('SELECT sealed FROM days WHERE local_date = ?', [date]);
  const reward = day?.sealed ? 1 : 0;
  ctx.db.run(
    `UPDATE decisions SET reward = ?
       WHERE local_date = ? AND point = 'nudge_hour' AND delivered = 1 AND reward IS NULL`,
    [reward, date],
  );
}

/**
 * 3. Flip experiment phases at their boundaries. Real and correct,
 * but inert until W8 seeds the first exp_phases row for an
 * experiment — nothing to act on before then.
 */
export function advancePhase(ctx: ReconcileContext, date: string): void {
  const ending = ctx.db.all<{ exp_id: string; phase: number; end_date: string }>(
    `SELECT exp_id, phase, end_date FROM exp_phases WHERE status = 'active' AND end_date <= ?`,
    [date],
  );
  const trialSeed = meta.get(ctx.db, 'trial_seed') ?? 'thread-default-seed';

  for (const row of ending) {
    ctx.db.run(`UPDATE exp_phases SET status = 'done' WHERE exp_id = ? AND phase = ?`, [row.exp_id, row.phase]);

    const nextPhase = row.phase + 1;
    if (nextPhase >= PHASES_PER_EXPERIMENT) continue; // reversal experiment complete

    const arm = phaseArm(trialSeed, row.exp_id, nextPhase);
    const start = addDays(row.end_date, 1);
    const end = addDays(start, PHASE_DAYS - 1);
    ctx.db.run(
      `INSERT INTO exp_phases (exp_id, phase, arm, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, 'active')
       ON CONFLICT(exp_id, phase) DO UPDATE SET
         arm = excluded.arm, start_date = excluded.start_date, end_date = excluded.end_date, status = 'active'`,
      [row.exp_id, nextPhase, arm, start, end],
    );
  }
}

/**
 * 4. Signature → dose ladder → response (§11). Only gapDays (days
 * since last seal) and the day-30 dormancy threshold are well-enough
 * specified to compute for real right now. Classifying *why* a lapse
 * is happening (cue_collapse vs dose_too_high vs book_fatigue vs...)
 * requires correlating signals not yet built (W11) — 'drift' is
 * written as the honest placeholder cause, not a guess at the real one.
 */
export function diagnose(ctx: ReconcileContext, date: string): void {
  const lastSealed = ctx.db.get<{ local_date: string }>(
    `SELECT local_date FROM days WHERE sealed = 1 AND local_date <= ? ORDER BY local_date DESC LIMIT 1`,
    [date],
  );
  const ladderDay = lastSealed ? daysBetweenExclusive(lastSealed.local_date, date) : 0;

  const signature: Signature = 'drift';
  const dose = meta.get(ctx.db, 'dose') ?? 'full_chapter';
  const dormant = ladderDay > 30 ? 1 : 0;

  ctx.db.run(
    `INSERT INTO state (local_date, signature, dose, ladder_day, dormant)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(local_date) DO UPDATE SET
       signature = excluded.signature, dose = excluded.dose,
       ladder_day = excluded.ladder_day, dormant = excluded.dormant`,
    [date, signature, dose, ladderDay, dormant],
  );
}

function daysBetweenExclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** 5. W12: dormant until day 366 (§13.5) — no bandit posteriors exist yet to update. Intentionally a no-op. */
export function updateBandit(_ctx: ReconcileContext, _date: string): void {
  // ships dormant — see §13.5 W12
}

/**
 * 6. Flag, never auto-repair (§17). Structural checks that don't
 * depend on any future work package — protect the log's integrity
 * from day one.
 */
export function checkInvariants(ctx: ReconcileContext, date: string): void {
  const violations: string[] = [];

  const day = ctx.db.get<{ sealed: number }>('SELECT sealed FROM days WHERE local_date = ?', [date]);
  if (day?.sealed === 1) {
    const sealEvent = ctx.db.get('SELECT 1 FROM events WHERE local_date = ? AND type = ?', [date, 'seal']);
    if (!sealEvent) violations.push(`days.sealed=1 for ${date} but no seal event exists`);
  }

  const dupes = ctx.db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM (
       SELECT local_date, point FROM decisions WHERE local_date = ? GROUP BY local_date, point HAVING COUNT(*) > 1
     )`,
    [date],
  );
  if ((dupes?.c ?? 0) > 0) violations.push(`duplicate decision rows for ${date}`);

  if (violations.length > 0) {
    const existing = meta.get(ctx.db, 'invariant_failed');
    meta.set(ctx.db, 'invariant_failed', existing ? `${existing}; ${violations.join('; ')}` : violations.join('; '));
  }
}

export const RECONCILE_STEPS: ReconcileSteps = {
  closeDay,
  attributeRewards,
  advancePhase,
  diagnose,
  updateBandit,
  checkInvariants,
};
