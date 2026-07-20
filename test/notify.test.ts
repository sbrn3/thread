import { describe, expect, it, vi } from 'vitest';
import { setProfile } from '../src/lab/profile';
import { meta } from '../src/log/log';
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

describe('Notifier (§13.3 /src/notify, §08, §10 E5 arm selection)', () => {
  it('syncWindow schedules a decision row per planned day, with a deterministic identifier', async () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_seed', 'fixed-seed');
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21, validated: true }, '2026-07-14');

    const rows = db.all<{ local_date: string; delivered: number; arm: string }>(
      "SELECT * FROM decisions WHERE point = 'nudge_hour'",
    );
    expect(rows).toHaveLength(30);
    // silence rows are delivered=1 immediately (nothing pending to cancel);
    // anchor_echo/neutral rows start at delivered=0 (pending an OS fire).
    for (const r of rows) {
      expect(r.delivered).toBe(r.arm === 'silence' ? 1 : 0);
    }
    expect(rows.some((r) => r.arm === 'anchor_echo' || r.arm === 'neutral')).toBe(true);
    // Only non-silence arms get an actual OS notification scheduled.
    const scheduledDates = rows.filter((r) => r.arm !== 'silence').length;
    expect(fake.scheduled.size).toBe(scheduledDates);
  });

  it('anchor_echo copy references the actual cue anchor', async () => {
    const db = openTestDb();
    migrate(db);
    // Pick a seed/date combination known to land on anchor_echo for day 1
    // (verified empirically) — the point under test is the copy content,
    // not the arm-selection distribution itself (covered in mrt.test.ts).
    let anchorEchoSeen = false;
    for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
      const trialDb = openTestDb();
      migrate(trialDb);
      meta.set(trialDb, 'trial_seed', seed);
      const fake = fakeNotifications();
      const notifier = new Notifier(trialDb, fake);
      await notifier.syncWindow({ anchor: 'my coffee', place: 'chair', nudgeHour: 21, validated: true }, '2026-07-14');
      for (const [, req] of fake.scheduled) {
        const body = (req as { content: { body: string } }).content.body;
        if (body.includes('my coffee')) anchorEchoSeen = true;
      }
    }
    expect(anchorEchoSeen).toBe(true);
  });

  it('syncWindow no-ops when permission is not granted', async () => {
    const db = openTestDb();
    migrate(db);
    const fake = fakeNotifications();
    fake.getPermissionsAsync = async () => ({ status: 'denied', canAskAgain: false });
    const notifier = new Notifier(db, fake);

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21, validated: true }, '2026-07-14');

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

  it('E7 arm B: skips the nudge on a day where the trailing week already has 5 sealed days', async () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_seed', 'fixed-seed');
    const today = '2026-07-14';
    // An active E7 phase, arm B, covering a wide window including today's plan.
    db.run(
      `INSERT INTO exp_phases (exp_id, phase, arm, start_date, end_date, status)
       VALUES ('E7', 0, 'B', '2026-07-01', '2026-08-01', 'active')`,
    );
    // 5 sealed days in the 7 days immediately before 2026-07-15 (tomorrow,
    // the first planned date): 07-08..07-12.
    for (const d of ['2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12']) {
      db.run(`INSERT INTO days (local_date, sealed, dose) VALUES (?, 1, 'full_chapter')`, [d]);
    }
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21, validated: true }, today);

    const tomorrowRow = db.get("SELECT 1 FROM decisions WHERE local_date = '2026-07-15' AND point = 'nudge_hour'");
    expect(tomorrowRow).toBeUndefined(); // quota already met — no nudge needed
  });

  it('E7 applied ("5_per_week"): the quota relaxation persists past the experiment\'s own phase window', async () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_seed', 'fixed-seed');
    setProfile(db, 'frequencyTarget', '5_per_week'); // as if E7 already concluded and was Applied — no active exp_phases row at all
    const today = '2026-07-14';
    for (const d of ['2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12']) {
      db.run(`INSERT INTO days (local_date, sealed, dose) VALUES (?, 1, 'full_chapter')`, [d]);
    }
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21, validated: true }, today);

    const tomorrowRow = db.get("SELECT 1 FROM decisions WHERE local_date = '2026-07-15' AND point = 'nudge_hour'");
    expect(tomorrowRow).toBeUndefined();
  });

  it('E7 arm A (or no active E7 phase): the weekly quota never suppresses a nudge', async () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_seed', 'fixed-seed');
    const today = '2026-07-14';
    for (const d of ['2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12']) {
      db.run(`INSERT INTO days (local_date, sealed, dose) VALUES (?, 1, 'full_chapter')`, [d]);
    }
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21, validated: true }, today);

    const tomorrowRow = db.get("SELECT 1 FROM decisions WHERE local_date = '2026-07-15' AND point = 'nudge_hour'");
    expect(tomorrowRow).toBeDefined(); // no arm-B phase active — normal daily behaviour
  });

  it('§13.5 W6b done-when: seal before the hour ⇒ silent all day AND the decision row is voided, not null-rewarded', async () => {
    const db = openTestDb();
    migrate(db);
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);
    const today = '2026-07-14';

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21, validated: true }, today);
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

  it('never voids a silence-arm decision — it has nothing to cancel and is already a complete comparison point', async () => {
    const db = openTestDb();
    migrate(db);
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);
    const today = '2026-07-14';

    db.run(
      `INSERT INTO decisions (ts, local_date, point, arm, explored, delivered)
       VALUES (0, ?, 'nudge_hour', 'silence', 0, 1)`,
      [today],
    );

    await notifier.cancelToday(today);

    const row = db.get<{ delivered: number }>(
      "SELECT delivered FROM decisions WHERE local_date = ? AND point = 'nudge_hour'",
      [today],
    );
    expect(row?.delivered).toBe(1); // untouched — voiding this would bias the MRT estimate toward silence
  });

  it('§11 offramp "pause": syncWindow no-ops entirely while meta.paused=1', async () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_seed', 'fixed-seed');
    meta.set(db, 'paused', '1');
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21, validated: true }, '2026-07-14');

    expect(db.all('SELECT * FROM decisions')).toHaveLength(0);
    expect(fake.scheduled.size).toBe(0);
  });

  it('§09/§12 one-nudge ceiling: never schedules a real notification for a date that already has any pending decision', async () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_seed', 'fixed-seed');
    const today = '2026-07-14';
    // A pending (delivered=0) decision from an unrelated point, on the
    // very first date syncWindow would otherwise plan for.
    db.run(
      `INSERT INTO decisions (ts, local_date, point, arm, explored, delivered) VALUES (0, '2026-07-15', 'dose_target', 'v20', 0, 0)`,
    );
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21, validated: true }, today);

    // The ceiling blocks the actual OS call for that date — no nudge_hour
    // row gets written for it, since scheduleNudgeOnce() only writes one
    // once scheduling actually happened.
    const blockedDateRow = db.get("SELECT 1 FROM decisions WHERE local_date = '2026-07-15' AND point = 'nudge_hour'");
    expect(blockedDateRow).toBeUndefined();
    expect([...fake.scheduled.keys()].some((id) => id.includes('2026-07-15'))).toBe(false);
  });

  it('§18 guardrails: silences entirely during dormancy, even with a valid cue and permission', async () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_seed', 'fixed-seed');
    const today = '2026-07-14';
    db.run(`INSERT INTO state (local_date, dormant, signature) VALUES (?, 1, 'drift')`, [today]);
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21, validated: true }, today);

    expect(db.all('SELECT * FROM decisions')).toHaveLength(0);
    expect(fake.scheduled.size).toBe(0);
  });

  it('§18 guardrails: silences entirely during a life_disruption signature', async () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_seed', 'fixed-seed');
    const today = '2026-07-14';
    db.run(`INSERT INTO state (local_date, dormant, signature) VALUES (?, 0, 'life_disruption')`, [today]);
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21, validated: true }, today);

    expect(db.all('SELECT * FROM decisions')).toHaveLength(0);
  });

  it('§18 adaptive layer: before day 366, still uses the E5 weighted-pick fallback, never the bandit', async () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_seed', 'fixed-seed');
    meta.set(db, 'trial_start', '2026-07-01'); // only 13 days before "today"
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21, validated: true }, '2026-07-14');

    const rows = db.all<{ bucket: string | null }>("SELECT bucket FROM decisions WHERE point = 'nudge_hour'");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.bucket === null)).toBe(true); // no bucket tagged — the bandit never ran
  });

  it('§18 adaptive layer: once active (day 366+), tags every planned decision with today\'s bucket', async () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_seed', 'fixed-seed');
    meta.set(db, 'trial_start', '2026-01-01');
    const fake = fakeNotifications();
    const notifier = new Notifier(db, fake);
    const today = '2027-01-05'; // > 365 days after trial_start

    await notifier.syncWindow({ anchor: 'coffee', place: 'chair', nudgeHour: 21, validated: true }, today);

    const rows = db.all<{ bucket: string | null }>("SELECT bucket FROM decisions WHERE point = 'nudge_hour'");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.bucket !== null)).toBe(true);
  });
});
