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
import { planSyncWindow } from './schedule';

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
    if ((await this.permission()) !== 'granted') return;

    const next30Days = Array.from({ length: 30 }, (_, i) => addDays(today, i + 1));
    const alreadyScheduled = new Set(
      this.db
        .all<{ local_date: string }>("SELECT local_date FROM decisions WHERE point = 'nudge_hour'")
        .map((r) => r.local_date),
    );
    const sealedDays = new Set(
      this.db.all<{ local_date: string }>('SELECT local_date FROM days WHERE sealed = 1').map((r) => r.local_date),
    );

    const trialSeed = meta.get(this.db, 'trial_seed') ?? 'thread-default-seed';
    const plan = planSyncWindow({ next30Days, alreadyScheduled, sealedDays });

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

      await this.notifications.scheduleNotificationAsync({
        identifier: identifierFor(date),
        content: copyFor(arm, cue),
        trigger: dateTrigger(date, cue.nudgeHour),
      });
      this.db.run(
        `INSERT INTO decisions (ts, local_date, point, arm, explored, delivered)
         VALUES (?, ?, 'nudge_hour', ?, 0, 0)`,
        [Date.now(), date, arm],
      );
    }
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
