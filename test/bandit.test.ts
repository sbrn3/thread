import { describe, expect, it } from 'vitest';
import {
  chooseArm,
  computeBucket,
  computeContext,
  describePolicy,
  guardrailsSilence,
  isAdaptiveActive,
  sampleBeta,
  updateBanditPosterior,
} from '../src/lab/bandit';
import { setProfile } from '../src/lab/profile';
import { mulberry32, hashSeed } from '../src/lab/prng';
import { meta } from '../src/log/log';
import { migrate } from '../src/log/schema';
import { openTestDb } from './util/testDb';

describe('isAdaptiveActive (§18 — ships dormant, activates day 366)', () => {
  it('is false with no trial_start at all', () => {
    const db = openTestDb();
    migrate(db);
    expect(isAdaptiveActive(db, '2027-07-14')).toBe(false);
  });

  it('is false before day 366', () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_start', '2026-07-14');
    expect(isAdaptiveActive(db, '2027-06-01')).toBe(false); // ~322 days in
  });

  it('is true once day 366 arrives', () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_start', '2026-07-14');
    expect(isAdaptiveActive(db, '2027-07-20')).toBe(true); // ~371 days in
  });

  it('one-tap freeze: profile.adaptive_frozen overrides everything, even past day 366', () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_start', '2026-07-14');
    setProfile(db, 'adaptive_frozen', '1');
    expect(isAdaptiveActive(db, '2027-07-20')).toBe(false);
  });
});

describe('computeBucket (§18 — FOUR buckets)', () => {
  it('is steady_recent when read today and nudged recently', () => {
    expect(computeBucket(0, 0)).toBe('steady_recent');
  });
  it('is lapsing_rested when not read today and no recent nudge', () => {
    expect(computeBucket(5, 10)).toBe('lapsing_rested');
  });
  it('steady/lapsing is driven purely by daysSinceRead === 0', () => {
    expect(computeBucket(1, 0)).toBe('lapsing_recent');
  });
});

describe('computeContext', () => {
  it('reports large sentinel gaps when nothing has ever happened', () => {
    const db = openTestDb();
    migrate(db);
    const ctx = computeContext(db, '2026-07-14');
    expect(ctx.daysSinceRead).toBeGreaterThan(1000);
    expect(ctx.nudgeRecencyDays).toBeGreaterThan(1000);
  });

  it('computes real gaps from days/decisions history', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-10', 1, 'full_chapter')`);
    db.run(`INSERT INTO decisions (local_date, point, arm) VALUES ('2026-07-12', 'nudge_hour', 'anchor_echo')`);

    const ctx = computeContext(db, '2026-07-14');
    expect(ctx.daysSinceRead).toBe(4);
    expect(ctx.nudgeRecencyDays).toBe(2);
  });

  it('a silence-arm decision never counts as a recent nudge', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO decisions (local_date, point, arm) VALUES ('2026-07-13', 'nudge_hour', 'silence')`);
    const ctx = computeContext(db, '2026-07-14');
    expect(ctx.nudgeRecencyDays).toBeGreaterThan(1000);
  });
});

describe('sampleBeta (§18 — seeded, no Math.random)', () => {
  it('is deterministic for the same rng stream', () => {
    const a = sampleBeta(mulberry32(hashSeed('s')), 3, 5);
    const b = sampleBeta(mulberry32(hashSeed('s')), 3, 5);
    expect(a).toBe(b);
  });

  it('is always in [0, 1]', () => {
    const rng = mulberry32(hashSeed('range-check'));
    for (let i = 0; i < 200; i++) {
      const v = sampleBeta(rng, 2, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('the sample mean over many draws converges toward alpha/(alpha+beta)', () => {
    const rng = mulberry32(hashSeed('mean-check'));
    const alpha = 8;
    const beta = 2;
    let sum = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) sum += sampleBeta(rng, alpha, beta);
    expect(sum / n).toBeCloseTo(alpha / (alpha + beta), 1);
  });
});

describe('chooseArm', () => {
  it('falls back below MIN_EVIDENCE (20 observations) rather than sampling an uninformative prior', () => {
    const db = openTestDb();
    migrate(db);
    expect(chooseArm(db, 'seed', '2026-07-14', 'steady_recent', 'neutral')).toBe('neutral');
  });

  it('is deterministic — the same (trialSeed, date, bucket) always resolves the same way', () => {
    const db = openTestDb();
    migrate(db);
    for (let i = 0; i < 25; i++) {
      updateBanditPosterior(db, 'anchor_echo', 'steady_recent', true, `2026-01-${String(i + 1).padStart(2, '0')}`);
    }
    const a = chooseArm(db, 'seed', '2026-07-14', 'steady_recent', 'neutral');
    const b = chooseArm(db, 'seed', '2026-07-14', 'steady_recent', 'neutral');
    expect(a).toBe(b);
  });
});

describe('updateBanditPosterior', () => {
  it('bumps alpha on reward, beta on no reward', () => {
    const db = openTestDb();
    migrate(db);
    updateBanditPosterior(db, 'neutral', 'steady_recent', true, '2026-07-01');
    let row = db.get<{ alpha: number; beta: number }>("SELECT alpha, beta FROM bandit WHERE arm='neutral' AND bucket='steady_recent'");
    expect(row!.alpha).toBeGreaterThan(1);
    expect(row!.beta).toBeCloseTo(1, 5);

    updateBanditPosterior(db, 'neutral', 'steady_recent', false, '2026-07-02');
    row = db.get<{ alpha: number; beta: number }>("SELECT alpha, beta FROM bandit WHERE arm='neutral' AND bucket='steady_recent'");
    expect(row!.beta).toBeGreaterThan(1);
  });

  it('never lets alpha or beta drop below the uniform prior floor of 1', () => {
    const db = openTestDb();
    migrate(db);
    for (let i = 0; i < 50; i++) {
      updateBanditPosterior(db, 'neutral', 'steady_recent', i % 2 === 0, `2026-${String(1 + (i % 12)).padStart(2, '0')}-01`);
    }
    const row = db.get<{ alpha: number; beta: number }>("SELECT alpha, beta FROM bandit WHERE arm='neutral' AND bucket='steady_recent'");
    expect(row!.alpha).toBeGreaterThanOrEqual(1);
    expect(row!.beta).toBeGreaterThanOrEqual(1);
  });

  it('resets to the uniform prior on a detected change-point, recording last_cp', () => {
    const db = openTestDb();
    migrate(db);
    // A long run of rewarded decisions recorded in `decisions` (not
    // just the posterior) so detectChangePoint has a real long-run
    // rate to compare the recent window against.
    for (let i = 0; i < 30; i++) {
      const d = `2026-01-${String((i % 28) + 1).padStart(2, '0')}`;
      db.run(
        `INSERT INTO decisions (local_date, point, arm, bucket, reward) VALUES (?, 'nudge_hour', 'neutral', 'steady_recent', 1)`,
        [d],
      );
    }
    // A sharply different recent window — reward collapses.
    for (let i = 0; i < 10; i++) {
      db.run(
        `INSERT INTO decisions (local_date, point, arm, bucket, reward) VALUES (?, 'nudge_hour', 'neutral', 'steady_recent', 0)`,
        [`2026-07-${String(i + 1).padStart(2, '0')}`],
      );
    }
    updateBanditPosterior(db, 'neutral', 'steady_recent', false, '2026-07-14');

    const row = db.get<{ alpha: number; beta: number; last_cp: string }>(
      "SELECT alpha, beta, last_cp FROM bandit WHERE arm='neutral' AND bucket='steady_recent'",
    );
    expect(row!.alpha).toBe(1);
    expect(row!.beta).toBe(1);
    expect(row!.last_cp).toBe('2026-07-14');
  });
});

describe('guardrailsSilence (§18 — outside the policy, can veto it)', () => {
  it('is false with no state row', () => {
    const db = openTestDb();
    migrate(db);
    expect(guardrailsSilence(db, '2026-07-14')).toBe(false);
  });

  it('silences during dormancy', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO state (local_date, dormant, signature) VALUES ('2026-07-14', 1, 'drift')`);
    expect(guardrailsSilence(db, '2026-07-14')).toBe(true);
  });

  it('silences during life_disruption, even if not dormant', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO state (local_date, dormant, signature) VALUES ('2026-07-14', 0, 'life_disruption')`);
    expect(guardrailsSilence(db, '2026-07-14')).toBe(true);
  });

  it('does not silence an ordinary healthy or lapsing day', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO state (local_date, dormant, signature) VALUES ('2026-07-14', 0, 'drift')`);
    expect(guardrailsSilence(db, '2026-07-14')).toBe(false);
  });
});

describe('describePolicy (§18 — plain-language, full auditability)', () => {
  it('reports still-learning status below MIN_EVIDENCE', () => {
    const db = openTestDb();
    migrate(db);
    expect(describePolicy(db, 'steady_recent')).toMatch(/still learning/i);
  });

  it('names the favoured arm once there is enough evidence', () => {
    const db = openTestDb();
    migrate(db);
    for (let i = 0; i < 25; i++) {
      updateBanditPosterior(db, 'anchor_echo', 'steady_recent', true, `2026-01-${String(i + 1).padStart(2, '0')}`);
    }
    expect(describePolicy(db, 'steady_recent')).toMatch(/anchor_echo/);
  });
});
