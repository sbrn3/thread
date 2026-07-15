import { describe, expect, it } from 'vitest';
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

  it('flags dormant past 30 days since the last seal (§11)', () => {
    const ctx = setup();
    ctx.db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-06-01', 1, 'full_chapter')`);

    diagnose(ctx, '2026-07-14'); // 43 days later

    const row = ctx.db.get<{ dormant: number }>("SELECT dormant FROM state WHERE local_date = '2026-07-14'");
    expect(row?.dormant).toBe(1);
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

describe('updateBandit (§13.5 W12 — ships dormant)', () => {
  it('is a no-op — nothing to update before day 366', () => {
    const ctx = setup();
    expect(() => updateBandit(ctx, '2026-07-14')).not.toThrow();
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
});
