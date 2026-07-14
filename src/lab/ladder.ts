// §11 (updated plan) — the lapse ladder. Late-only by design: offering
// to summon a friend on day 3 would dramatise a normal miss into an
// event — the exact mechanism that kills habits. Six real causes for
// "not reading"; the app diagnoses before it acts, and never escalates.

export type Signature =
  | 'cue_collapse' // cue_strength falls sharply while opens continue
  | 'dose_too_high' // high opens, low seals; scroll_pct stalls mid-chapter
  | 'book_fatigue' // rate collapses within this book but was healthy in the last
  | 'life_disruption' // total silence, abrupt onset, no prior decline
  | 'mechanic_friction' // hold_cancel > 15%; opens without seals on days you clearly read
  | 'drift'; // everything works; the app simply isn't opened

export const ALL_SIGNATURES: Signature[] = [
  'cue_collapse',
  'dose_too_high',
  'book_fatigue',
  'life_disruption',
  'mechanic_friction',
  'drift',
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
export function ladder(gapDays: number, sig: Signature, hasPartner: boolean): LadderResponse {
  // Life disruption: do nothing for 7 days, full stop — a person in a
  // crisis does not need their Bible app pinging them. This overrides
  // the normal gap thresholds below, not just the day-7 routing.
  if (sig === 'life_disruption' && gapDays <= 7) return { action: 'none' };

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

/**
 * §11 mechanic-friction override: hold_cancel > 15% ⇒ seal reverts to
 * tap immediately, without waiting for E1. Unlike the rest of the
 * ladder this isn't gated by a lapse gap — it can fire on ANY day,
 * because a friction problem doesn't need days to accumulate before
 * it's worth fixing. Callers check this independently of ladder().
 */
export function mechanicFrictionThreshold(holdCancelRate: number): boolean {
  return holdCancelRate > 0.15;
}
