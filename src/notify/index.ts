// §13.3 contract. Implementation lands in W6b, on a dev build (not
// Expo Go — background notification scheduling needs native config).
//
// Mechanics (§08), all enforced here and nowhere else:
// - scheduled for the chosen hour ONLY if the day is still unsealed
// - sealing cancels that day's notification AND voids its decision row
//   (a voided row is NOT a delivered arm with a null reward — counting
//   it as such biases every MRT estimate toward silence)
// - fires at most once per day; no escalation, ever
// - every fire logs nudge_fired; opening from it logs nudge_opened

export interface Notifier {
  /** Maintain the rolling 30-day schedule (iOS caps 64 pending). */
  syncWindow(): Promise<void>;
  /** On seal → cancel today's notification and void the decision row. */
  cancelToday(): Promise<void>;
  permission(): Promise<'granted' | 'denied' | 'undetermined'>;
}
