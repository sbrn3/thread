import type { Arm } from '../log/types';
import { seededBool } from './prng';

// Engine rules (§09): phase length 21 days, four phases per reversal
// experiment, order randomized once per experiment (ABAB or BABA).
// Hard-coded, not user-configurable.
export const PHASE_DAYS = 21;
export const PHASES_PER_EXPERIMENT = 4;

/**
 * §13.4 — seeded, so the year is reconstructible. Same seed ⇒ same
 * year ⇒ auditable. The order is never shown to the user.
 */
export function phaseArm(trialSeed: string, expId: string, phase: number): Arm {
  const flip = seededBool(trialSeed, expId); // ABAB or BABA, decided once
  const pattern: Arm[] = flip ? ['A', 'B', 'A', 'B'] : ['B', 'A', 'B', 'A'];
  return pattern[phase];
}
