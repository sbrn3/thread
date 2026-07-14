// §13.3 /src/notify. §08 mechanics, enforced in notifier.ts and
// nowhere else:
// - scheduled for the chosen hour ONLY if the day is still unsealed
// - sealing cancels that day's notification AND voids its decision row
//   (a voided row is NOT a delivered arm with a null reward — counting
//   it as such biases every MRT estimate toward silence)
// - fires at most once per day; no escalation, ever
// - every fire logs nudge_fired; opening from it logs nudge_opened
//   (device-only concerns — a foreground listener wires these once
//   the app is running on a dev build; see README)

export { Notifier, type NotificationsLike } from './notifier';
export { planSyncWindow, type PlannedNudge, type SyncPlanInput } from './schedule';
