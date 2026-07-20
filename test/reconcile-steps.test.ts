import { describe, expect, it } from 'vitest';
import { getProfile } from '../src/lab/profile';
import { Log, meta } from '../src/log/log';
import { migrate } from '../src/log/schema';
import type { ReconcileContext } from '../src/lab/reconcile';
import {
  advancePhase,
  attributeRewards,
  checkInvariants,
  closeDay,
  diagnose,
  updateBandit,
} from '../src/lab/steps';
import { openTestDb } from './util/testDb';

function setup(): ReconcileContext {
  const db = openTestDb();
  migrate(db);
  const log = new Log({ db, buildSha: 'test-sha' });
  return { db, log };
}

describe('closeDay (§13.4 reconcile step 1)', () => {
  it('derives the days row from that date\'s events, same as Log.rebuildDays', () => {
    const ctx = setup();
    ctx.log.write({ type: 'seal', book: 'john', chapter: 3, before_nudge: 1 });
    const date = ctx.db.get<{ local_date: string }>('SELECT local_date FROM events')!.local_date;

    closeDay(ctx, date);

    const day = ctx.db.get<{ sealed: number; book: string }>('SELECT * FROM days WHERE local_date = ?', [date]);
    expect(day?.sealed).toBe(1);
    expect(day?.book).toBe('john');
  });

  it('has no transaction of its own — safe to call inside reconcile\'s outer transaction', () => {
    const ctx = setup();
    ctx.log.write({ type: 'seal', book: 'john', chapter: 3 });
    const date = ctx.db.get<{ local_date: string }>('SELECT local_date FROM events')!.local_date;
    // Calling closeDay from inside an already-open transaction must not throw
    // (a naive nested db.tx() call would, depending on the driver).
    expect(() => ctx.db.tx(() => closeDay(ctx, date))).not.toThrow();
  });

  it('flags a day disturbed on a cue_changed event (§13 confound detection)', () => {
    const ctx = setup();
    ctx.log.write({ type: 'cue_changed' });
    const date = ctx.db.get<{ local_date: string }>('SELECT local_date FROM events')!.local_date;

    closeDay(ctx, date);

    expect(ctx.db.get<{ disturbed: number }>('SELECT disturbed FROM days WHERE local_date = ?', [date])?.disturbed).toBe(1);
  });

  it('flags a day disturbed on a 7+ day gap since the last seal', () => {
    const ctx = setup();
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-01', 1, 'full_chapter')`);
    ctx.log.write({ type: 'reading_start', book: 'john', chapter: 1 });
    // Force the event's local_date to be 7 days after the last seal.
    ctx.db.run(`UPDATE events SET local_date = '2026-07-08'`);

    closeDay(ctx, '2026-07-08');

    expect(
      ctx.db.get<{ disturbed: number }>("SELECT disturbed FROM days WHERE local_date = '2026-07-08'")?.disturbed,
    ).toBe(1);
  });

  it('leaves a normal day undisturbed', () => {
    const ctx = setup();
    ctx.log.write({ type: 'seal', book: 'john', chapter: 3 });
    const date = ctx.db.get<{ local_date: string }>('SELECT local_date FROM events')!.local_date;

    closeDay(ctx, date);

    expect(ctx.db.get<{ disturbed: number }>('SELECT disturbed FROM days WHERE local_date = ?', [date])?.disturbed).toBe(0);
  });
});

describe('attributeRewards (§13.4 reconcile step 2)', () => {
  it('is currently a correct no-op: nothing has delivered=1 yet (no live listener wired)', () => {
    const ctx = setup();
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-14', 1, 'full_chapter')`);
    ctx.db.run(
      `INSERT INTO decisions (local_date, point, arm, delivered) VALUES ('2026-07-14', 'nudge_hour', 'anchor_echo', 0)`,
    );

    attributeRewards(ctx, '2026-07-14');

    const row = ctx.db.get<{ reward: number | null }>("SELECT reward FROM decisions WHERE local_date = '2026-07-14'");
    expect(row?.reward).toBeNull(); // delivered=0, not touched
  });

  it('fills reward=1 for a sealed day once a row is marked delivered', () => {
    const ctx = setup();
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-14', 1, 'full_chapter')`);
    ctx.db.run(
      `INSERT INTO decisions (local_date, point, arm, delivered) VALUES ('2026-07-14', 'nudge_hour', 'anchor_echo', 1)`,
    );

    attributeRewards(ctx, '2026-07-14');

    const row = ctx.db.get<{ reward: number }>("SELECT reward FROM decisions WHERE local_date = '2026-07-14'");
    expect(row?.reward).toBe(1);
  });

  it('fills reward=0 for an unsealed day', () => {
    const ctx = setup();
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-14', 0, 'full_chapter')`);
    ctx.db.run(
      `INSERT INTO decisions (local_date, point, arm, delivered) VALUES ('2026-07-14', 'nudge_hour', 'anchor_echo', 1)`,
    );

    attributeRewards(ctx, '2026-07-14');

    const row = ctx.db.get<{ reward: number }>("SELECT reward FROM decisions WHERE local_date = '2026-07-14'");
    expect(row?.reward).toBe(0);
  });

  it('also fills reward for dose_target (E10) decisions — always delivered=1, so it fills immediately', () => {
    const ctx = setup();
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-14', 1, 'full_chapter')`);
    ctx.db.run(
      `INSERT INTO decisions (local_date, point, arm, delivered) VALUES ('2026-07-14', 'dose_target', 'v20', 1)`,
    );

    attributeRewards(ctx, '2026-07-14');

    const row = ctx.db.get<{ reward: number }>(
      "SELECT reward FROM decisions WHERE local_date = '2026-07-14' AND point = 'dose_target'",
    );
    expect(row?.reward).toBe(1);
  });
});

describe('advancePhase (§13.4 reconcile step 3, §13 "one reversal at a time")', () => {
  it('is a no-op with no trial_start set, or before the 21-day baseline ends', () => {
    const ctx = setup();
    expect(() => advancePhase(ctx, '2026-07-14')).not.toThrow();
    expect(ctx.db.all('SELECT * FROM exp_phases')).toHaveLength(0);

    meta.set(ctx.db, 'trial_start', '2026-07-01');
    advancePhase(ctx, '2026-07-10'); // day 9 — baseline (21d) not over yet
    expect(ctx.db.all('SELECT * FROM exp_phases')).toHaveLength(0);
  });

  it('seeds the first queued experiment (E7 — it runs first, §14) the day the 21-day baseline ends', () => {
    const ctx = setup();
    meta.set(ctx.db, 'trial_seed', 'fixed-seed');
    meta.set(ctx.db, 'trial_start', '2026-07-01');

    advancePhase(ctx, '2026-07-22'); // trial_start + 21

    const row = ctx.db.get<{ exp_id: string; phase: number; status: string; start_date: string }>(
      'SELECT * FROM exp_phases',
    );
    expect(row).toMatchObject({ exp_id: 'E7', phase: 0, status: 'active', start_date: '2026-07-22' });
  });

  it('flips to the next phase when the active one ends, using the seeded arm sequence', () => {
    const ctx = setup();
    meta.set(ctx.db, 'trial_seed', 'fixed-seed');
    ctx.db.run(
      `INSERT INTO exp_phases (exp_id, phase, arm, start_date, end_date, status)
       VALUES ('E1', 0, 'A', '2026-06-24', '2026-07-14', 'active')`,
    );

    advancePhase(ctx, '2026-07-14');

    const rows = ctx.db.all<{ phase: number; status: string; start_date: string }>(
      "SELECT phase, status, start_date FROM exp_phases WHERE exp_id = 'E1' ORDER BY phase",
    );
    expect(rows).toEqual([
      { phase: 0, status: 'done', start_date: '2026-06-24' },
      { phase: 1, status: 'active', start_date: '2026-07-15' },
    ]);
  });

  it('chains to the next queued experiment once one finishes all 4 phases', () => {
    const ctx = setup();
    meta.set(ctx.db, 'trial_seed', 'fixed-seed');
    // E4 is first in the queue; E1 is next. Finishing E4's phase 3 should seed E1.
    ctx.db.run(
      `INSERT INTO exp_phases (exp_id, phase, arm, start_date, end_date, status)
       VALUES ('E4', 3, 'B', '2026-06-24', '2026-07-14', 'active')`,
    );

    advancePhase(ctx, '2026-07-14');

    expect(ctx.db.get("SELECT status FROM exp_phases WHERE exp_id = 'E4' AND phase = 3")).toEqual({
      status: 'done',
    });
    const e1 = ctx.db.get<{ phase: number; status: string; start_date: string }>(
      "SELECT phase, status, start_date FROM exp_phases WHERE exp_id = 'E1'",
    );
    expect(e1).toEqual({ phase: 0, status: 'active', start_date: '2026-07-15' });
  });

  it('marks the last queued experiment (E3) fully done with nothing queued after it', () => {
    const ctx = setup();
    meta.set(ctx.db, 'trial_seed', 'fixed-seed');
    ctx.db.run(
      `INSERT INTO exp_phases (exp_id, phase, arm, start_date, end_date, status)
       VALUES ('E3', 3, 'B', '2026-06-24', '2026-07-14', 'active')`,
    );

    advancePhase(ctx, '2026-07-14');

    const rows = ctx.db.all("SELECT * FROM exp_phases");
    expect(rows).toHaveLength(1); // nothing new seeded — E3 is last in REVERSAL_QUEUE
    expect((rows[0] as { status: string }).status).toBe('done');
  });
});

describe('diagnose (§13.4 reconcile step 4)', () => {
  it('computes ladder_day as days since the last sealed day', () => {
    const ctx = setup();
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-01', 1, 'full_chapter')`);

    diagnose(ctx, '2026-07-06');

    const row = ctx.db.get<{ ladder_day: number; dormant: number }>(
      "SELECT ladder_day, dormant FROM state WHERE local_date = '2026-07-06'",
    );
    expect(row?.ladder_day).toBe(5);
    expect(row?.dormant).toBe(0);
  });

  it('flags dormant past day 14 since the last seal — conformed to ladder()\'s own tested tiers, not the plan prose\'s day 30', () => {
    const ctx = setup();
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-06-01', 1, 'full_chapter')`);

    diagnose(ctx, '2026-07-14'); // 43 days later

    const row = ctx.db.get<{ dormant: number }>("SELECT dormant FROM state WHERE local_date = '2026-07-14'");
    expect(row?.dormant).toBe(1);
  });

  it('dormancy boundary is exactly day 14/15, matching ladder()\'s offramp/dormant tiers', () => {
    const ctx14 = setup();
    ctx14.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-01', 1, 'full_chapter')`);
    diagnose(ctx14, '2026-07-15'); // 14 days later
    expect(ctx14.db.get<{ dormant: number }>("SELECT dormant FROM state WHERE local_date = '2026-07-15'")?.dormant).toBe(0);

    const ctx15 = setup();
    ctx15.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-01', 1, 'full_chapter')`);
    diagnose(ctx15, '2026-07-16'); // 15 days later
    expect(ctx15.db.get<{ dormant: number }>("SELECT dormant FROM state WHERE local_date = '2026-07-16'")?.dormant).toBe(1);
  });

  it('classifies a real signature the morning a lapse starts, and carries it forward unchanged for the rest of the lapse', () => {
    const ctx = setup();
    // hold_cancel-heavy window ⇒ mechanic_friction (also auto-applies profile.seal='tap').
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-01', 1, 'full_chapter')`);
    for (let i = 0; i < 5; i++) {
      ctx.db.run(`INSERT INTO events (ts, tz_offset, local_date, type, build_sha) VALUES (0, 0, '2026-06-25', 'hold_cancel', 't')`);
    }
    ctx.db.run(`INSERT INTO events (ts, tz_offset, local_date, type, build_sha) VALUES (0, 0, '2026-06-25', 'seal', 't')`);

    diagnose(ctx, '2026-07-02'); // ladder_day = 1 — classifies fresh
    diagnose(ctx, '2026-07-03'); // ladder_day = 2 — carries forward

    const day1 = ctx.db.get<{ signature: string }>("SELECT signature FROM state WHERE local_date = '2026-07-02'");
    const day2 = ctx.db.get<{ signature: string }>("SELECT signature FROM state WHERE local_date = '2026-07-03'");
    expect(day1?.signature).toBe('mechanic_friction');
    expect(day2?.signature).toBe('mechanic_friction'); // carried forward, not recomputed
    expect(getProfile(ctx.db, 'seal')).toBe('tap'); // §11 — automatic, no question asked
  });

  it('dose ladder steps down once at ladder_day=2, and back up once a fresh 7-day streak completes', () => {
    const ctx = setup();
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-01', 1, 'full_chapter')`);

    diagnose(ctx, '2026-07-02'); // ladder_day = 1 — no step yet
    expect(meta.get(ctx.db, 'dose')).toBeNull();
    diagnose(ctx, '2026-07-03'); // ladder_day = 2 — steps down once
    expect(meta.get(ctx.db, 'dose')).toBe('half_sitting');
    diagnose(ctx, '2026-07-04'); // ladder_day = 3 — does not step again
    expect(meta.get(ctx.db, 'dose')).toBe('half_sitting');

    // A fresh 7-day seal streak, immediately after, steps it back up once.
    let d = new Date('2026-07-04T00:00:00Z');
    for (let i = 0; i < 7; i++) {
      d = new Date(d.getTime() + 86_400_000);
      const iso = d.toISOString().slice(0, 10);
      ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES (?, 1, 'full_chapter')`, [iso]);
      diagnose(ctx, iso);
    }
    expect(meta.get(ctx.db, 'dose')).toBe('full_chapter');
  });

  it('records a real ladder_action/ladder_payload for a lapsing day, null for a healthy one', () => {
    const ctx = setup();
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-01', 1, 'full_chapter')`);

    diagnose(ctx, '2026-07-01'); // healthy day (ladder_day=0)
    const healthy = ctx.db.get<{ ladder_action: string | null }>(
      "SELECT ladder_action FROM state WHERE local_date = '2026-07-01'",
    );
    expect(healthy?.ladder_action).toBeNull();

    diagnose(ctx, '2026-07-06'); // ladder_day = 5 — one_question tier
    const lapsing = ctx.db.get<{ ladder_action: string; ladder_payload: string }>(
      "SELECT ladder_action, ladder_payload FROM state WHERE local_date = '2026-07-06'",
    );
    expect(lapsing?.ladder_action).toBe('one_question');
    expect(JSON.parse(lapsing!.ladder_payload)).toMatchObject({ action: 'one_question' });
  });

  it('carries the current dose from meta, defaulting to full_chapter', () => {
    const ctx = setup();
    diagnose(ctx, '2026-07-14');
    expect(ctx.db.get<{ dose: string }>("SELECT dose FROM state WHERE local_date = '2026-07-14'")?.dose).toBe(
      'full_chapter',
    );
  });

  it('records the E6 post-miss MRT decision exactly on the morning a lapse starts (ladder_day = 1)', () => {
    const ctx = setup();
    meta.set(ctx.db, 'trial_seed', 'fixed-seed');
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-13', 1, 'full_chapter')`);

    diagnose(ctx, '2026-07-14'); // ladder_day = 1 — the morning after

    const decision = ctx.db.get<{ point: string; arm: string; delivered: number }>(
      "SELECT point, arm, delivered FROM decisions WHERE point = 'post_miss_morning'",
    );
    expect(decision?.point).toBe('post_miss_morning');
    expect(['re_entry', 'none']).toContain(decision?.arm);
    expect(decision?.delivered).toBe(1);
  });

  it('does not record an E6 decision on subsequent days of an ongoing lapse, or on a healthy day', () => {
    const ctx = setup();
    meta.set(ctx.db, 'trial_seed', 'fixed-seed');
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-01', 1, 'full_chapter')`);

    diagnose(ctx, '2026-07-05'); // ladder_day = 4, not the start of the lapse

    expect(ctx.db.all("SELECT * FROM decisions WHERE point = 'post_miss_morning'")).toHaveLength(0);
  });
});

describe('updateBandit (§13.5/§18 — ships dormant, activates day 366)', () => {
  it('is a no-op — nothing to update before day 366', () => {
    const ctx = setup();
    expect(() => updateBandit(ctx, '2026-07-14')).not.toThrow();
    expect(ctx.db.all('SELECT * FROM bandit')).toHaveLength(0);
  });

  it('is still a no-op before day 366 even with a trial_start set', () => {
    const ctx = setup();
    meta.set(ctx.db, 'trial_start', '2026-07-01');
    ctx.db.run(
      `INSERT INTO decisions (local_date, point, arm, bucket, reward) VALUES ('2026-07-14', 'nudge_hour', 'neutral', 'steady_recent', 1)`,
    );
    updateBandit(ctx, '2026-07-14'); // ~13 days in
    expect(ctx.db.all('SELECT * FROM bandit')).toHaveLength(0);
  });

  it('folds a bucketed, rewarded decision into its posterior once day 366 arrives, exactly once', () => {
    const ctx = setup();
    meta.set(ctx.db, 'trial_start', '2026-01-01');
    const date = '2027-01-05'; // > 365 days after trial_start
    ctx.db.run(
      `INSERT INTO decisions (local_date, point, arm, bucket, reward) VALUES (?, 'nudge_hour', 'neutral', 'steady_recent', 1)`,
      [date],
    );

    updateBandit(ctx, date);
    const row = ctx.db.get<{ alpha: number; beta: number }>(
      "SELECT alpha, beta FROM bandit WHERE arm = 'neutral' AND bucket = 'steady_recent'",
    );
    expect(row!.alpha).toBeGreaterThan(1);

    // Re-running (reconcile's own idempotency requirement) must not
    // fold the same decision in twice — bandit_updated guards this.
    updateBandit(ctx, date);
    const again = ctx.db.get<{ alpha: number }>(
      "SELECT alpha FROM bandit WHERE arm = 'neutral' AND bucket = 'steady_recent'",
    );
    expect(again!.alpha).toBe(row!.alpha);
  });

  it('never touches a decision with no bucket (pre-adaptive era, or the E5/E10 fallback path)', () => {
    const ctx = setup();
    meta.set(ctx.db, 'trial_start', '2026-01-01');
    const date = '2027-01-05';
    ctx.db.run(
      `INSERT INTO decisions (local_date, point, arm, bucket, reward) VALUES (?, 'nudge_hour', 'neutral', NULL, 1)`,
      [date],
    );
    updateBandit(ctx, date);
    expect(ctx.db.all('SELECT * FROM bandit')).toHaveLength(0);
  });
});

describe('checkInvariants (§13.4 reconcile step 6, §17 — flag, never auto-repair)', () => {
  it('flags a sealed day with no corresponding seal event, and never deletes/fixes it', () => {
    const ctx = setup();
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-14', 1, 'full_chapter')`);

    checkInvariants(ctx, '2026-07-14');

    expect(meta.get(ctx.db, 'invariant_failed')).toMatch(/sealed=1.*no seal event/);
    // Never auto-repaired:
    expect(ctx.db.get('SELECT sealed FROM days')).toEqual({ sealed: 1 });
  });

  it('flags duplicate decision rows for the same (date, point)', () => {
    const ctx = setup();
    ctx.db.run(`INSERT INTO decisions (local_date, point, arm) VALUES ('2026-07-14', 'nudge_hour', 'a')`);
    ctx.db.run(`INSERT INTO decisions (local_date, point, arm) VALUES ('2026-07-14', 'nudge_hour', 'b')`);

    checkInvariants(ctx, '2026-07-14');

    expect(meta.get(ctx.db, 'invariant_failed')).toMatch(/duplicate decision rows/);
  });

  it('is silent when nothing is wrong', () => {
    const ctx = setup();
    ctx.log.write({ type: 'seal', book: 'john', chapter: 3 });
    const date = ctx.db.get<{ local_date: string }>('SELECT local_date FROM events')!.local_date;
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES (?, 1, 'full_chapter')`, [date]);

    checkInvariants(ctx, date);

    expect(meta.get(ctx.db, 'invariant_failed')).toBeNull();
  });

  it('§19 invariant 1: flags a watermark regression', () => {
    const ctx = setup();
    meta.set(ctx.db, 'watermark', '2026-07-20');

    checkInvariants(ctx, '2026-07-14'); // reconciling an earlier date than the watermark already reached

    expect(meta.get(ctx.db, 'invariant_failed')).toMatch(/watermark regression/);
  });

  it('§19 invariant 3: flags a seal-event/sealed-day count mismatch', () => {
    const ctx = setup();
    // Two seal events on the same date, but only one days row derived —
    // an over-count that deriveDayRow's single sealed=1 flag can't reflect.
    ctx.db.run(`INSERT INTO events (ts, tz_offset, local_date, type, build_sha) VALUES (0, 0, '2026-07-14', 'seal', 't')`);
    ctx.db.run(`INSERT INTO events (ts, tz_offset, local_date, type, build_sha) VALUES (0, 0, '2026-07-14', 'seal', 't')`);
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-14', 1, 'full_chapter')`);

    checkInvariants(ctx, '2026-07-14');

    expect(meta.get(ctx.db, 'invariant_failed')).toMatch(/seal event count.*!=.*sealed day count/);
  });

  it('§19 invariant 5: flags an event whose stored local_date disagrees with its own ts/tz_offset', () => {
    const ctx = setup();
    // ts for noon UTC on 2026-07-14, tz_offset=0 (UTC) → re-derives to
    // 2026-07-14 (noon - 4h boundary is still the 14th) — but stored
    // local_date claims a different day entirely.
    const ts = Date.UTC(2026, 6, 14, 12, 0, 0);
    ctx.db.run(`INSERT INTO events (ts, tz_offset, local_date, type, build_sha) VALUES (?, 0, '2026-07-20', 'app_open', 't')`, [ts]);

    checkInvariants(ctx, '2026-07-20');

    expect(meta.get(ctx.db, 'invariant_failed')).toMatch(/local_date 2026-07-20 != re-derived 2026-07-14/);
  });

  it('§19 invariant 6: flags two simultaneously-active phases for the same experiment', () => {
    const ctx = setup();
    ctx.db.run(
      `INSERT INTO exp_phases (exp_id, phase, arm, start_date, end_date, status) VALUES ('E1', 0, 'A', '2026-06-01', '2026-06-21', 'active')`,
    );
    ctx.db.run(
      `INSERT INTO exp_phases (exp_id, phase, arm, start_date, end_date, status) VALUES ('E1', 1, 'B', '2026-06-22', '2026-07-12', 'active')`,
    );

    checkInvariants(ctx, '2026-07-14');

    expect(meta.get(ctx.db, 'invariant_failed')).toMatch(/two active phases simultaneously/);
  });

  it('§19 invariant 4: flags a bandit posterior below the uniform prior floor', () => {
    const ctx = setup();
    ctx.db.run(
      `INSERT INTO bandit (arm, bucket, alpha, beta, n_obs) VALUES ('neutral', 'steady_recent', 0.5, 1, 1)`,
    );

    checkInvariants(ctx, '2026-07-14');

    expect(meta.get(ctx.db, 'invariant_failed')).toMatch(/bandit posterior.*below the prior floor/);
  });

  it('§19 invariant 4: a normal posterior at or above the floor is silent', () => {
    const ctx = setup();
    ctx.db.run(
      `INSERT INTO bandit (arm, bucket, alpha, beta, n_obs) VALUES ('neutral', 'steady_recent', 3, 2, 2)`,
    );

    checkInvariants(ctx, '2026-07-14');

    expect(meta.get(ctx.db, 'invariant_failed')).toBeNull();
  });
});
