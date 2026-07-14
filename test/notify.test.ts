import { describe, expect, it, vi } from 'vitest';
import { migrate } from '../src/log/schema';
import type { NotificationsLike } from '../src/notify/notifier';
import { Notifier } from '../src/notify/notifier';
import { planSyncWindow } from '../src/notify/schedule';
import { openTestDb } from './util/testDb';

describe('planSyncWindow (§13.4 — pure, no device needed)', () => {
  const next30Days = ['2026-07-15', '2026-07-16', '2026-07-17'];

  it('plans every future day with no schedule and no seal', () => {
    const plan = planSyncWindow({ next30Days, alreadyScheduled: new Set(), sealedDays: new Set() });
    expect(plan.map((p) => p.date)).toEqual(next30Days);
  });

  it('skips days already scheduled', () => {
    const plan = planSyncWindow({
      next30Days,
      alreadyScheduled: new Set(['2026-07-16']),
      sealedDays: new Set(),
    });
    expect(plan.map((p) => p.date)).toEqual(['2026-07-15', '2026-07-17']);
  });

  it('skips days already sealed — no nudge needed for a day already read', () => {
    const plan = planSyncWindow({
      next30Days,
      alreadyScheduled: new Set(),
      sealedDays: new Set(['2026-07-15', '2026-07-17']),
    });
    expect(plan.map((p) => p.date)).toEqual(['2026-07-16']);
  });
});

function fakeNotifications(): NotificationsLike & { scheduled: Map<string, unknown>; cancelled: string[] } {
  const scheduled = new Map<string, unknown>();
  const cancelled: string[] = [];
  return {
    scheduled,
    cancelled,
    async getPermissionsAsync() {
      return { status: 'granted', canAskAgain: true };
    },
    async requestPermissionsAsync() {
      return { status: 'granted' };
    },
    async scheduleNotificationAsync(request) {
      const id = request.identifier ?? `id-${scheduled.size}`;
      scheduled.set(id, request);
      return id;
    },
    async cancelScheduledNotificationAsync(identifier) {
      cancelled.push(identifier);
      scheduled.delete(identifier);
    },
  };
}

describe('Notifier (§13.3 /src/notify, §08)', () => {
  it('syncWindow schedules a decision row per planned day, with a deterministic identifier', async () => {
    const db = openTestDb();
    migrate(db);
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21 }, '2026-07-14');

    const rows = db.all<{ local_date: string; delivered: number }>(
      "SELECT * FROM decisions WHERE point = 'nudge_hour'",
    );
    expect(rows).toHaveLength(30);
    expect(rows.every((r) => r.delivered === 0)).toBe(true);
    expect(fake.scheduled.has('nudge-2026-07-15')).toBe(true);
  });

  it('syncWindow no-ops when permission is not granted', async () => {
    const db = openTestDb();
    migrate(db);
    const fake = fakeNotifications();
    fake.getPermissionsAsync = async () => ({ status: 'denied', canAskAgain: false });
    const notifier = new Notifier(db, fake);

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21 }, '2026-07-14');

    expect(db.all('SELECT * FROM decisions')).toHaveLength(0);
    expect(fake.scheduled.size).toBe(0);
  });

  it('permission() requests only when askable, and reports denied without asking otherwise', async () => {
    const db = openTestDb();
    migrate(db);
    const fake = fakeNotifications();
    fake.getPermissionsAsync = async () => ({ status: 'denied', canAskAgain: false });
    const requestSpy = vi.spyOn(fake, 'requestPermissionsAsync');
    const notifier = new Notifier(db, fake);

    expect(await notifier.permission()).toBe('denied');
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('§13.5 W6b done-when: seal before the hour ⇒ silent all day AND the decision row is voided, not null-rewarded', async () => {
    const db = openTestDb();
    migrate(db);
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);
    const today = '2026-07-14';

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21 }, today);
    // Today itself isn't in the "next 30 days" window (strictly future), so
    // schedule it directly to exercise cancellation the same way an
    // already-scheduled day would look after a prior syncWindow ran.
    await fake.scheduleNotificationAsync({
      identifier: 'nudge-2026-07-14',
      content: { title: 'Thread', body: "Haven't read yet today." },
      trigger: null,
    });
    db.run(
      `INSERT INTO decisions (ts, local_date, point, arm, explored, delivered)
       VALUES (0, ?, 'nudge_hour', 'anchor_echo', 0, 0)`,
      [today],
    );

    await notifier.cancelToday(today);

    // Silent: the OS notification is actually cancelled.
    expect(fake.cancelled).toContain('nudge-2026-07-14');
    expect(fake.scheduled.has('nudge-2026-07-14')).toBe(false);

    // Voided, not null-rewarded: delivered stays 0 and reward is never set to null-as-failure.
    const row = db.get<{ delivered: number; reward: number | null }>(
      "SELECT * FROM decisions WHERE local_date = ? AND point = 'nudge_hour'",
      [today],
    );
    expect(row?.delivered).toBe(0);
    expect(row?.reward).toBeNull();
  });
});
