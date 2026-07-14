// Type-only import — erased at compile time, so this module never
// actually loads the native expo-notifications package (which isn't
// loadable outside React Native, and so isn't testable under vitest).
// The real module is supplied at construction time (see services/index.ts).
import type * as ExpoNotifications from 'expo-notifications';
import type { Cue } from '../cue';
import type { SqlDb } from '../log/db';
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

const DEFAULT_COPY = { title: 'Thread', body: "Haven't read yet today." };

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

  /** Maintains the rolling 30-day schedule. No-ops silently if permission isn't granted. */
  async syncWindow(cue: Cue, today: string = logicalToday()): Promise<void> {
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

    const plan = planSyncWindow({ next30Days, alreadyScheduled, sealedDays });
    for (const { date } of plan) {
      await this.notifications.scheduleNotificationAsync({
        identifier: identifierFor(date),
        content: DEFAULT_COPY,
        trigger: dateTrigger(date, cue.nudgeHour),
      });
      this.db.run(
        `INSERT INTO decisions (ts, local_date, point, arm, explored, delivered)
         VALUES (?, ?, 'nudge_hour', 'anchor_echo', 0, 0)`,
        [Date.now(), date],
      );
    }
  }

  /**
   * On seal: cancel today's notification (a deterministic identifier,
   * so this works even across an app restart between scheduling and
   * sealing) and void today's decision row. Voiding sets delivered
   * back to 0 explicitly — the same value it started at — because a
   * voided row and a not-yet-fired row must be indistinguishable from
   * "genuinely delivered" ones in the eventual MRT analysis.
   */
  async cancelToday(today: string = logicalToday()): Promise<void> {
    await this.notifications.cancelScheduledNotificationAsync(identifierFor(today));
    this.db.run("UPDATE decisions SET delivered = 0 WHERE local_date = ? AND point = 'nudge_hour'", [today]);
  }
}
