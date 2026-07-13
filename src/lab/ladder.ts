// §13.4 — the lapse ladder. Late-only by design: offering to summon a
// friend on day 3 would dramatise a normal miss into an event — the
// exact mechanism that kills habits.

export type Signature =
  | 'healthy'
  | 'cue_collapse'
  | 'dose_too_high'
  | 'book_fatigue'
  | 'unknown';

export const ALL_SIGNATURES: Signature[] = [
  'healthy',
  'cue_collapse',
  'dose_too_high',
  'book_fatigue',
  'unknown',
];

export type LadderResponse =
  | { action: 'none' }
  | { action: 'reduce_dose'; silent: true }
  | { action: 'one_question'; route: Signature }
  | { action: 'offramp'; options: Array<'pause' | 'keep_nudging' | 'handoff'> }
  | { action: 'dormant'; farewell: 'handoff' | 'silent' };

// THE HARD CONSTRAINT (§13.4): there is no argument, no signature, no
// policy, and no bandit arm that can produce an outbound message to
// the partner. This function returns UI offers only; /src/partner
// exposes no method capable of contacting anyone unprompted, and the
// "app never contacts the partner" test sweeps all 365 × signature
// combinations.
export function ladder(
  gapDays: number,
  sig: Signature,
  hasPartner: boolean,
): LadderResponse {
  if (gapDays <= 1) return { action: 'none' }; // be boring about it
  if (gapDays <= 3) return { action: 'reduce_dose', silent: true };
  if (gapDays <= 7) return { action: 'one_question', route: sig };
  if (gapDays <= 14) {
    const options: Array<'pause' | 'keep_nudging' | 'handoff'> = ['pause', 'keep_nudging'];
    if (hasPartner) options.push('handoff'); // only if one exists
    return { action: 'offramp', options };
  }
  return { action: 'dormant', farewell: hasPartner ? 'handoff' : 'silent' };
}
