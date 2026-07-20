import { activeE10Arm } from './dose';
import { ladder, type Signature } from './ladder';
import { setProfile } from './profile';
import { buildSignatureContext, classifySignature } from './signature';
import { computeStreak, deriveDayRow, meta } from '../log/log';
import { addDays, datesBetween, logicalDateFromOffset } from '../log/time';
import type { Dose } from '../log/types';
import type { ReconcileContext, ReconcileSteps } from './reconcile';
import { hasConfound } from './confound';
import { weightedPick } from './mrt';
import { PHASES_PER_EXPERIMENT, PHASE_DAYS, phaseArm } from './phases';
import { REVERSAL_QUEUE, type ReversalExpId } from './registry';

const DOSE_RUNGS: Dose[] = ['full_chapter', 'half_sitting', 'single_passage', 'one_verse'];

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
 * 2. Fill decisions.reward for this date's decisions. Proximal
 * outcome: sealed that day — the same signal for every point that
 * gets a per-day reward (nudge_hour AND dose_target/E10; the richer
 * recall-weighted composite E10 actually needs for its curve fit is
 * computed separately, at analysis time, from the raw days/probes
 * tables — see analysis/dose.ts). nudge_hour is only ever filled for
 * delivered=1 rows — and nothing sets that flag yet (it requires a
 * live notification-received listener, a device-level piece not
 * built in this pass). Correct now, genuinely inert until that
 * listener exists; not a stub, since the semantics are real and won't
 * need revisiting. dose_target rows are always delivered=1 (E10 is
 * an assignment, not something that can fail to arrive), so those
 * fill immediately.
 */
export function attributeRewards(ctx: ReconcileContext, date: string): void {
  const day = ctx.db.get<{ sealed: number }>('SELECT sealed FROM days WHERE local_date = ?', [date]);
  const reward = day?.sealed ? 1 : 0;
  ctx.db.run(
    `UPDATE decisions SET reward = ?
       WHERE local_date = ? AND point IN ('nudge_hour', 'dose_target') AND delivered = 1 AND reward IS NULL`,
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
 * MRT decision point and the E10 decision record.
 *
 * Signature is classified once, the morning a lapse starts (ladder_day
 * transitions to 1), and carried forward unchanged for the rest of
 * that lapse — recomputing it daily against an increasingly empty
 * trailing window would let the diagnosis silently drift as the gap
 * grows, which isn't what "why is this happening" is supposed to mean.
 *
 * The dose ladder steps down exactly once per lapse (the first day
 * reduce_dose applies, ladder_day===2) and back up exactly once a
 * fresh 7-day seal streak completes — silent, reversible, and it's
 * the mechanism that makes todaysTarget() (dose.ts) actually vary
 * during a real lapse, not just from an applied E10 result.
 *
 * The day-30 dormancy threshold in the plan's prose and ladder.ts's
 * own tested tiers disagree (ladder() calls it dormant past day 14,
 * not 30) — conformed to ladder.ts here, since that's the side with
 * real, already-passing tests establishing its exact boundaries.
 */
export function diagnose(ctx: ReconcileContext, date: string): void {
  const lastSealed = ctx.db.get<{ local_date: string }>(
    `SELECT local_date FROM days WHERE sealed = 1 AND local_date <= ? ORDER BY local_date DESC LIMIT 1`,
    [date],
  );
  const ladderDay = lastSealed ? datesBetween(lastSealed.local_date, date).length : 0;

  let signature: Signature;
  if (ladderDay === 0) {
    signature = 'drift'; // not lapsing — the value is moot
  } else if (ladderDay === 1) {
    signature = classifySignature(buildSignatureContext(ctx.db, date));
    // §11 mechanic-friction override — automatic, not a question:
    // "Seal reverts to tap immediately, without waiting for E1."
    // Applied the moment this signature is diagnosed, silently.
    if (signature === 'mechanic_friction') setProfile(ctx.db, 'seal', 'tap');
  } else {
    const yesterday = ctx.db.get<{ signature: Signature }>('SELECT signature FROM state WHERE local_date = ?', [
      addDays(date, -1),
    ]);
    signature = yesterday?.signature ?? 'drift';
  }

  // Dose ladder stepping — before reading `dose` below, so today's
  // state row and todaysTarget() both see the post-step value.
  if (ladderDay === 2) {
    const current = (meta.get(ctx.db, 'dose') ?? 'full_chapter') as Dose;
    const idx = DOSE_RUNGS.indexOf(current);
    if (idx < DOSE_RUNGS.length - 1) meta.set(ctx.db, 'dose', DOSE_RUNGS[idx + 1]);
  }
  if (ladderDay === 0 && computeStreak(ctx.db, date) === 7) {
    const current = (meta.get(ctx.db, 'dose') ?? 'full_chapter') as Dose;
    const idx = DOSE_RUNGS.indexOf(current);
    if (idx > 0) meta.set(ctx.db, 'dose', DOSE_RUNGS[idx - 1]);
  }

  const dose = meta.get(ctx.db, 'dose') ?? 'full_chapter';
  const dormant = ladderDay > 14 ? 1 : 0;

  const hasPartner = !!ctx.db.get('SELECT 1 FROM partner WHERE id = 1');
  const response = ladderDay > 0 ? ladder(ladderDay, signature, hasPartner) : null;

  ctx.db.run(
    `INSERT INTO state (local_date, signature, dose, ladder_day, dormant, ladder_action, ladder_payload, ladder_responded)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(local_date) DO UPDATE SET
       signature = excluded.signature, dose = excluded.dose,
       ladder_day = excluded.ladder_day, dormant = excluded.dormant,
       ladder_action = excluded.ladder_action, ladder_payload = excluded.ladder_payload`,
    [date, signature, dose, ladderDay, dormant, response?.action ?? null, response ? JSON.stringify(response) : null],
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

  // E10: recorded once daily, here — never from live session code
  // (which recomputes the same deterministic arm purely, with no
  // write, to size today's actual reading — see dose.ts).
  const e10Arm = activeE10Arm(ctx.db, date);
  if (e10Arm) {
    const already = ctx.db.get(`SELECT 1 FROM decisions WHERE local_date = ? AND point = 'dose_target'`, [date]);
    if (!already) {
      ctx.db.run(
        `INSERT INTO decisions (ts, local_date, point, arm, explored, delivered)
         VALUES (?, ?, 'dose_target', ?, 0, 1)`,
        [Date.now(), date, e10Arm],
      );
    }
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

  // 1. watermark never regresses. Checked against the value as it
  // stood before THIS iteration's own update — reconcile() sets it
  // AFTER all 6 steps run, so it still holds the prior day here.
  const watermark = meta.get(ctx.db, 'watermark');
  if (watermark !== null && date <= watermark) {
    violations.push(`watermark regression: reconciling ${date} but watermark is already ${watermark}`);
  }

  // 2. exactly one decision row per scheduled point per day, and a
  // sealed day always has the seal event that should have produced it.
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

  // 3. Σ(seal events) === Σ(days shown sealed in the weave) — a
  // running total up to this date, not just today's own count.
  const sealCounts = ctx.db.get<{ seal_events: number; sealed_days: number }>(
    `SELECT
       (SELECT COUNT(*) FROM events WHERE type = 'seal' AND local_date <= ?) as seal_events,
       (SELECT COUNT(*) FROM days WHERE sealed = 1 AND local_date <= ?) as sealed_days`,
    [date, date],
  );
  if (sealCounts && sealCounts.seal_events !== sealCounts.sealed_days) {
    violations.push(
      `seal event count (${sealCounts.seal_events}) != sealed day count (${sealCounts.sealed_days}) as of ${date}`,
    );
  }

  // 4. bandit α+β for a bucket only increases between reconciles —
  // deferred to Phase 10/W13: there's no bandit updater yet to check
  // against, so this would trivially pass against an empty table.

  // 5. every event's local_date matches what its own ts/tz_offset
  // re-derives, independent of the device's CURRENT timezone.
  const todaysEvents = ctx.db.all<{ id: number; ts: number; tz_offset: number; local_date: string }>(
    'SELECT id, ts, tz_offset, local_date FROM events WHERE local_date = ?',
    [date],
  );
  for (const e of todaysEvents) {
    const recomputed = logicalDateFromOffset(e.ts, e.tz_offset);
    if (recomputed !== e.local_date) {
      violations.push(`event ${e.id}: stored local_date ${e.local_date} != re-derived ${recomputed}`);
    }
  }

  // 6. no experiment has two arms active for the same exp_id.
  const doubleActive = ctx.db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM (
       SELECT exp_id FROM exp_phases WHERE status = 'active' GROUP BY exp_id HAVING COUNT(*) > 1
     )`,
  );
  if ((doubleActive?.c ?? 0) > 0) violations.push(`an experiment has two active phases simultaneously`);

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
