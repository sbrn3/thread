import type { AppEvent } from '../log/types';

/**
 * §13 confound detection: a cue_changed event or a 7+ day gap flags
 * the day disturbed; disturbed days are reported but excluded from
 * verdicts. A normal book_finish does NOT confound (books run
 * 4–30 chapters against 21-day phases, so most phases contain one —
 * flagging every one would disqualify nearly all data). Only an
 * abandoned book (a lapse-driven exit) would, and that needs the
 * lapse ladder wired to a real UI decision (W11) — deferred, not
 * silently assumed to never happen.
 */
export function hasConfound(events: AppEvent[], gapDays: number): boolean {
  const cueChanged = events.some((e) => e.type === 'cue_changed');
  return cueChanged || gapDays >= 7;
}
