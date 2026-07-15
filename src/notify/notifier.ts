// Type-only import — erased at compile time, so this module never
// actually loads the native expo-notifications package (which isn't
// loadable outside React Native, and so isn't testable under vitest).
// The real module is supplied at construction time (see services/index.ts).
import type * as ExpoNotifications from 'expo-notifications';
import type { Cue } from '../cue';
import { weightedPick } from '../lab/mrt';
import type { SqlDb } from '../log/db';
import { meta } from '../log/log';
import { addDays, logicalToday } from '../log/time';
import { getProfile } from '../lab/profile';
import { planSyncWindow } from './schedule';

/**
 * §14 E7 arm B ("5 days/week, any 5") — changes what counts as a
 * miss, not what the reading flow looks like. Applies for a day if
 * either it falls inside an active E7-arm-B phase (the experiment
 * itself is running), or the experiment already concluded and was
 * Applied with the '5_per_week' arm (profile.frequencyTarget), which
 * makes the relaxation permanent rather than bounded to the phase
 * window. Only ever relaxes the seed/arm-A behaviour, never tightens it.
 */
function e7ArmBActive(db: SqlDb, date: string): boolean {
  if (getProfile(db, 'frequencyTarget') === '5_per_week') return true;

  const phase = db.get<{ arm: string; start_date: string; end_date: string }>(
    `SELECT arm, start_date, end_date FROM exp_phases WHERE exp_id = 'E7' AND status = 'active'`,
  );
  return !!phase && phase.arm === 'B' && date >= phase.start_date && date <= phase.end_date;
}

function weeklyQuotaMet(sealedDatesSorted: readonly string[], date: string): boolean {
  const windowStart = addDays(date, -7);
  const count = sealedDatesSorted.filter((d) => d >= windowStart && d < date).length;
  return count >= 5;
}

// Minimal surface of expo-notifications this module needs — injectable
// so tests can supply a fake instead of touching the real native module.
export interface NotificationsLike {
  getPermissionsAsync(): Promise<{ status: string; canAskAgain: boolean }>;
  requestPermissionsAsync(): Promise<{ status: string }>;
  scheduleNotificationAsync(request: ExpoNotifications.NotificationRequestInput): Promise<string>;
  cancelScheduledNotificationAsync(identifier: string): Promise<void>;
}

// §10 E5 — anchor-echo (p=.4), neutral (p=.4), silence (p=.2).
type NudgeArm = 'anchor_echo' | 'neutral' | 'silence';
const NUDGE_WEIGHTS: Record<NudgeArm, number> = { anchor_echo: 0.4, neutral: 0.4, silence: 0.2 };

function copyFor(arm: NudgeArm, cue: Cue): { title: string; body: string } {
  return arm === 'anchor_echo'
    ? { title: 'Thread', body: `Haven't read after ${cue.anchor} yet today.` }
    : { title: 'Thread', body: "Haven't read yet today." };
}

function identifierFor(date: string): string {
  return `nudge-${date}`;
}

function dateTrigger(date: string, hour: number): ExpoNotifications.DateTriggerInput {
  const [y, m, d] = date.split('-').map(Number);
  return {
    // Runtime value of ExpoNotifications.SchedulableTriggerInputTypes.DATE —
    // asserted rather than referenced, since the enum object itself is
    // only available as a type here (see the import note above).
    type: 'date' as ExpoNotifications.SchedulableTriggerInputTypes.DATE,
    date: new Date(y, m - 1, d, hour, 0, 0),
  };
}

/**
 * §13.3 /src/notify contract, §08 mechanics: the notification is a
 * safety net, not the cue. Scheduled only if the day is still
 * unsealed; sealing cancels it and voids the decision row rather
 * than leaving a null-rewarded delivered row, which would bias every
 * MRT estimate toward silence (§13.4).
 */
export class Notifier {
  constructor(
    private readonly db: SqlDb,
    private readonly notifications: NotificationsLike,
  ) {}

  async permission(): Promise<'granted' | 'denied' | 'undetermined'> {
    const current = await this.notifications.getPermissionsAsync();
    if (current.status === 'granted') return 'granted';
    if (!current.canAskAgain) return current.status === 'denied' ? 'denied' : 'undetermined';
    const requested = await this.notifications.requestPermissionsAsync();
    return requested.status as 'granted' | 'denied' | 'undetermined';
  }

  /**
   * Maintains the rolling 30-day schedule. No-ops silently if
   * permission isn't granted, or if the cue has no nudge hour at all
   * ("No nudge at all" is a valid onboarding choice — §05).
   */
  async syncWindow(cue: Cue, today: string = logicalToday()): Promise<void> {
    if (cue.nudgeHour === null) return;
    if (meta.get(this.db, 'paused') === '1') return; // §11 offramp — "pause," chosen from the lapse ladder's offer
    if ((await this.permission()) !== 'granted') return;

    const next30Days = Array.from({ length: 30 }, (_, i) => addDays(today, i + 1));
    const alreadyScheduled = new Set(
      this.db
        .all<{ local_date: string }>("SELECT local_date FROM decisions WHERE point = 'nudge_hour'")
        .map((r) => r.local_date),
    );
    const sealedDatesSorted = this.db
      .all<{ local_date: string }>('SELECT local_date FROM days WHERE sealed = 1 ORDER BY local_date')
      .map((r) => r.local_date);
    const quotaMetDays = next30Days.filter(
      (d) => e7ArmBActive(this.db, d) && weeklyQuotaMet(sealedDatesSorted, d),
    );
    const noNudgeNeeded = new Set([...sealedDatesSorted, ...quotaMetDays]);

    const trialSeed = meta.get(this.db, 'trial_seed') ?? 'thread-default-seed';
    const plan = planSyncWindow({ next30Days, alreadyScheduled, sealedDays: noNudgeNeeded });

    for (const { date } of plan) {
      const arm = weightedPick(trialSeed, `E5:${date}`, NUDGE_WEIGHTS);

      if (arm === 'silence') {
        // Nothing to schedule, and so nothing cancelToday() could ever
        // void — delivered=1 immediately. A silence day is a complete,
        // countable comparison point the moment it's assigned, not a
        // pending one waiting on an OS notification.
        this.db.run(
          `INSERT INTO decisions (ts, local_date, point, arm, explored, delivered)
           VALUES (?, ?, 'nudge_hour', 'silence', 0, 1)`,
          [Date.now(), date],
        );
        continue;
      }

      const scheduled = await this.scheduleNudgeOnce(date, {
        identifier: identifierFor(date),
        content: copyFor(arm, cue),
        trigger: dateTrigger(date, cue.nudgeHour),
      });
      if (scheduled) {
        this.db.run(
          `INSERT INTO decisions (ts, local_date, point, arm, explored, delivered)
           VALUES (?, ?, 'nudge_hour', ?, 0, 0)`,
          [Date.now(), date, arm],
        );
      }
    }
  }

  /**
   * §09 "at most once per day. Ever. No escalation..." — the
   * one-nudge ceiling, as an un-bypassable wrapper (§12/W12): this is
   * the only place in the app that actually calls the native
   * scheduling API, and it re-checks freshly here rather than
   * trusting every caller to have already excluded the date, so a
   * future decision point can never accidentally schedule a second
   * nudge the same day no matter how it gets wired in. Returns
   * whether it actually scheduled.
   */
  private async scheduleNudgeOnce(
    date: string,
    request: ExpoNotifications.NotificationRequestInput,
  ): Promise<boolean> {
    const alreadyPending = this.db.get('SELECT 1 FROM decisions WHERE local_date = ? AND delivered = 0', [date]);
    if (alreadyPending) return false;
    await this.notifications.scheduleNotificationAsync(request);
    return true;
  }

  /**
   * On seal: cancel today's notification (a deterministic identifier,
   * so this works even across an app restart between scheduling and
   * sealing) and void today's decision row — but only if one was
   * actually scheduled. A silence-arm row has nothing to cancel and
   * must never be voided: it's already a valid, complete comparison
   * point, and zeroing its delivered flag would bias the MRT estimate
   * toward silence by erasing exactly the days silence "worked"
   * (§13.4).
   */
  async cancelToday(today: string = logicalToday()): Promise<void> {
    await this.notifications.cancelScheduledNotificationAsync(identifierFor(today));
    this.db.run(
      "UPDATE decisions SET delivered = 0 WHERE local_date = ? AND point = 'nudge_hour' AND arm != 'silence'",
      [today],
    );
  }
}
