// Pure planning logic for syncWindow() (§13.4), kept separate from
// the actual expo-notifications calls so it's testable without a
// device. iOS caps 64 pending notifications, so this only ever plans
// a rolling 30-day window and skips dates already scheduled or
// already sealed (no nudge needed for a day already read).

export interface SyncPlanInput {
  next30Days: readonly string[]; // dates, ascending, strictly after today
  alreadyScheduled: ReadonlySet<string>;
  sealedDays: ReadonlySet<string>;
}

export interface PlannedNudge {
  date: string;
}

export function planSyncWindow({ next30Days, alreadyScheduled, sealedDays }: SyncPlanInput): PlannedNudge[] {
  return next30Days.filter((d) => !alreadyScheduled.has(d) && !sealedDays.has(d)).map((date) => ({ date }));
}
