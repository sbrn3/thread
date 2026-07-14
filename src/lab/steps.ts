import { deriveDayRow, meta } from '../log/log';
import { addDays, datesBetween } from '../log/time';
import type { ReconcileContext, ReconcileSteps } from './reconcile';
import { hasConfound } from './confound';
import { weightedPick } from './mrt';
import { PHASES_PER_EXPERIMENT, PHASE_DAYS, phaseArm } from './phases';
import { REVERSAL_QUEUE, type ReversalExpId } from './registry';
import type { Signature } from './ladder';

/**
 * 1. Derive the days row for this date from its events, then flag
 * confounds (§13): a cue_changed event or a 7+ day gap. Disturbed
 * days are reported but excluded from experiment verdicts — flagged
 * here, not repaired or hidden.
 */
export function closeDay(ctx: ReconcileContext, date: string): void {
  deriveDayRow(ctx.db, ctx.log, date);

  const events = ctx.log.eventsOn(date);
  const lastSealed = ctx.db.get<{ local_date: string }>(
    `SELECT local_date FROM days WHERE sealed = 1 AND local_date < ? ORDER BY local_date DESC LIMIT 1`,
    [date],
  );
  const gapDays = lastSealed ? datesBetween(lastSealed.local_date, date).length : 0;
  const disturbed = hasConfound(events, gapDays) ? 1 : 0;
  ctx.db.run('UPDATE days SET disturbed = ? WHERE local_date = ?', [disturbed, date]);
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

function seedPhase(ctx: ReconcileContext, expId: ReversalExpId, phase: number, startDate: string, trialSeed: string): void {
  const arm = phaseArm(trialSeed, expId, phase);
  const end = addDays(startDate, PHASE_DAYS - 1);
  ctx.db.run(
    `INSERT INTO exp_phases (exp_id, phase, arm, start_date, end_date, status)
     VALUES (?, ?, ?, ?, ?, 'active')
     ON CONFLICT(exp_id, phase) DO UPDATE SET
       arm = excluded.arm, start_date = excluded.start_date, end_date = excluded.end_date, status = 'active'`,
    [expId, phase, arm, startDate, end],
  );
}

/**
 * 3. Flip experiment phases at their boundaries, and advance the
 * serial reversal queue (§13 "one reversal at a time" — E4, E1, E3 in
 * order; see registry.ts for what's deliberately not queued yet).
 * The first experiment starts after the 21-day baseline; each
 * following one starts the day after the previous finishes its 4th
 * phase.
 */
export function advancePhase(ctx: ReconcileContext, date: string): void {
  const trialSeed = meta.get(ctx.db, 'trial_seed') ?? 'thread-default-seed';

  const anyPhases = ctx.db.get<{ c: number }>('SELECT COUNT(*) as c FROM exp_phases');
  if ((anyPhases?.c ?? 0) === 0) {
    const trialStart = meta.get(ctx.db, 'trial_start');
    if (trialStart && date >= addDays(trialStart, PHASE_DAYS)) {
      seedPhase(ctx, REVERSAL_QUEUE[0], 0, date, trialSeed);
    }
    return;
  }

  const ending = ctx.db.all<{ exp_id: string; phase: number; end_date: string }>(
    `SELECT exp_id, phase, end_date FROM exp_phases WHERE status = 'active' AND end_date <= ?`,
    [date],
  );

  for (const row of ending) {
    ctx.db.run(`UPDATE exp_phases SET status = 'done' WHERE exp_id = ? AND phase = ?`, [row.exp_id, row.phase]);

    const nextPhase = row.phase + 1;
    if (nextPhase < PHASES_PER_EXPERIMENT) {
      seedPhase(ctx, row.exp_id as ReversalExpId, nextPhase, addDays(row.end_date, 1), trialSeed);
      continue;
    }

    // This reversal experiment just completed all 4 phases — start
    // the next one in the queue, if any.
    const queueIndex = REVERSAL_QUEUE.indexOf(row.exp_id as ReversalExpId);
    const next = REVERSAL_QUEUE[queueIndex + 1];
    if (next) seedPhase(ctx, next, 0, addDays(row.end_date, 1), trialSeed);
  }
}

/**
 * 4. Signature → dose ladder → response (§11), plus the E6 post-miss
 * MRT decision point ("the morning after any unsealed day", §10):
 * randomized once per lapse-start, independent of the reversal queue.
 * Only gapDays/ladderDay and the day-30 dormancy threshold are
 * well-enough specified to compute for real right now. Classifying
 * *why* a lapse is happening (cue_collapse vs dose_too_high vs
 * book_fatigue vs...) requires correlating signals not yet built
 * (W11) — 'drift' is written as the honest placeholder cause, not a
 * guess at the real one.
 */
export function diagnose(ctx: ReconcileContext, date: string): void {
  const lastSealed = ctx.db.get<{ local_date: string }>(
    `SELECT local_date FROM days WHERE sealed = 1 AND local_date <= ? ORDER BY local_date DESC LIMIT 1`,
    [date],
  );
  const ladderDay = lastSealed ? datesBetween(lastSealed.local_date, date).length : 0;

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

  // E6: exactly the morning a lapse starts (ladder_day transitions to
  // 1) is the decision point — not every day of an ongoing lapse.
  if (ladderDay === 1) {
    const trialSeed = meta.get(ctx.db, 'trial_seed') ?? 'thread-default-seed';
    const arm = weightedPick(trialSeed, `E6:${date}`, { re_entry: 0.5, none: 0.5 });
    ctx.db.run(
      `INSERT INTO decisions (ts, local_date, point, arm, explored, delivered)
       VALUES (?, ?, 'post_miss_morning', ?, 0, 1)`,
      [Date.now(), date, arm],
    );
  }
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
