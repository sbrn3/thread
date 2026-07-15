import type { SqlDb } from '../log/db';
import { meta } from '../log/log';
import { addDays } from '../log/time';
import type { Dose } from '../log/types';
import { weightedPick } from './mrt';
import { getProfile } from './profile';

const E10_START_DAY = 190;
const E10_WEIGHTS = { v10: 0.25, v20: 0.25, v30: 0.25, v45: 0.25 } as const;
type E10Arm = keyof typeof E10_WEIGHTS;
const E10_VALUES: Record<E10Arm, number> = { v10: 10, v20: 20, v30: 30, v45: 45 };

/**
 * §11 — the reactive dose ladder's rungs, in fixed verse counts (same
 * approach as E10's fixed arms) rather than fractions of "today's
 * chapter," since resolving a fraction would need the text provider
 * and this must stay synchronous. `full_chapter` maps to null: no
 * override, the ladder is at its baseline rung.
 */
const DOSE_LADDER_TARGETS: Record<Dose, number | null> = {
  full_chapter: null,
  half_sitting: 20,
  single_passage: 10,
  one_verse: 1,
};

/**
 * §14 — pure (no write; the `decisions` row this corresponds to is
 * recorded once daily by diagnose(), not here — this may be called
 * more than once per day from live session code, and weightedPick is
 * deterministic, so recomputing it is always safe, just never the
 * place that persists it). Returns null before day 190, or whenever
 * E4 is currently active — arm B ("one verse counts") makes a fixed
 * verse target meaningless, so the two must never overlap.
 */
export function activeE10Arm(db: SqlDb, date: string): E10Arm | null {
  const trialStart = meta.get(db, 'trial_start');
  if (!trialStart || date < addDays(trialStart, E10_START_DAY)) return null;

  const e4Active = db.get('SELECT 1 FROM exp_phases WHERE exp_id = ? AND status = ?', ['E4', 'active']);
  if (e4Active) return null;

  const trialSeed = meta.get(db, 'trial_seed') ?? 'thread-default-seed';
  return weightedPick(trialSeed, `E10:${date}`, E10_WEIGHTS);
}

export function activeE10Target(db: SqlDb, date: string): number | null {
  const arm = activeE10Arm(db, date);
  return arm ? E10_VALUES[arm] : null;
}

/**
 * §16.5 resolution order: the lapse ladder wins during a lapse — its
 * current rung (meta['dose'], stepped by diagnose() in steps.ts) is
 * checked first and, whenever it's below the full_chapter baseline,
 * wins outright, never fighting an applied E10 result or the still-
 * live randomization. Otherwise: an applied E10 dose (profile.doseTarget
 * — the found dose overrides the randomization once Applied), else an
 * active E10 dose arm, else the titrated target (not built — Year 2),
 * else null, meaning "seed mode": no fixed verse target, just today's
 * own chapter length, capped by splitSittings' default.
 */
export function todaysTarget(db: SqlDb, date: string): number | null {
  const rung = meta.get(db, 'dose') as Dose | null;
  const ladderTarget = rung ? DOSE_LADDER_TARGETS[rung] : null;
  if (ladderTarget !== null) return ladderTarget;

  const applied = getProfile(db, 'doseTarget');
  if (applied !== null) return Number(applied);
  return activeE10Target(db, date);
}
