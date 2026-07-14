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

describe('advancePhase (§13.4 reconcile step 3)', () => {
  it('is a correct no-op when no experiment has been seeded yet (W8)', () => {
    const ctx = setup();
    expect(() => advancePhase(ctx, '2026-07-14')).not.toThrow();
    expect(ctx.db.all('SELECT * FROM exp_phases')).toHaveLength(0);
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

  it('marks the experiment done after its last phase, without inserting a 5th', () => {
    const ctx = setup();
    meta.set(ctx.db, 'trial_seed', 'fixed-seed');
    ctx.db.run(
      `INSERT INTO exp_phases (exp_id, phase, arm, start_date, end_date, status)
       VALUES ('E1', 3, 'B', '2026-06-24', '2026-07-14', 'active')`,
    );

    advancePhase(ctx, '2026-07-14');

    const rows = ctx.db.all("SELECT * FROM exp_phases WHERE exp_id = 'E1'");
    expect(rows).toHaveLength(1);
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
