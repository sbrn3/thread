import { describe, expect, it } from 'vitest';
import { ALL_SIGNATURES, ladder, mechanicFrictionThreshold } from '../src/lab/ladder';
import { PHASES_PER_EXPERIMENT, phaseArm } from '../src/lab/phases';
import { hashSeed, mulberry32, seededBool, seededUniform } from '../src/lab/prng';
import { Log, meta } from '../src/log/log';
import { migrate } from '../src/log/schema';
import { reconcile, type ReconcileSteps } from '../src/lab/reconcile';
import { openTestDb } from './util/testDb';

describe('seeded PRNG (§16.7 — no Math.random anywhere)', () => {
  it('same seed ⇒ same stream', () => {
    const a = mulberry32(hashSeed('trial-1'));
    const b = mulberry32(hashSeed('trial-1'));
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('seededBool / seededUniform are stable per (seed, key)', () => {
    expect(seededBool('s', 'E1')).toBe(seededBool('s', 'E1'));
    expect(seededUniform('s', '2026-07-14:nudge')).toBe(seededUniform('s', '2026-07-14:nudge'));
  });
});

describe('phase assignment (§13.4)', () => {
  it('yields ABAB or BABA, decided once per experiment, reconstructible', () => {
    for (const exp of ['E1', 'E3', 'E4', 'E8']) {
      const pattern = Array.from({ length: PHASES_PER_EXPERIMENT }, (_, p) =>
        phaseArm('trial-seed', exp, p),
      );
      expect([['A', 'B', 'A', 'B'], ['B', 'A', 'B', 'A']]).toContainEqual(pattern);
      // same seed ⇒ same year
      expect(pattern).toEqual(
        Array.from({ length: PHASES_PER_EXPERIMENT }, (_, p) => phaseArm('trial-seed', exp, p)),
      );
    }
  });
});

describe('the lapse ladder (§11)', () => {
  it('is graduated: boring → silent dose drop → one question → offramp → dormant', () => {
    expect(ladder(1, 'drift', true)).toEqual({ action: 'none' });
    expect(ladder(3, 'drift', true)).toEqual({ action: 'reduce_dose', silent: true });
    expect(ladder(6, 'book_fatigue', true)).toEqual({
      action: 'one_question',
      route: 'book_fatigue',
    });
    expect(ladder(10, 'drift', false)).toEqual({
      action: 'offramp',
      options: ['pause', 'keep_nudging'],
    });
    expect(ladder(20, 'drift', false)).toEqual({ action: 'dormant', farewell: 'silent' });
  });

  it('offers hand-off only when a partner exists', () => {
    expect(ladder(10, 'drift', true).action).toBe('offramp');
    expect((ladder(10, 'drift', true) as { options: string[] }).options).toContain('handoff');
    expect((ladder(10, 'drift', false) as { options: string[] }).options).not.toContain('handoff');
  });

  it('life_disruption overrides the normal gap thresholds: nothing for 7 days, full stop', () => {
    for (let gap = 2; gap <= 7; gap++) {
      expect(ladder(gap, 'life_disruption', true)).toEqual({ action: 'none' });
    }
    // Day 8 onward, the normal ladder resumes wherever the gap lands —
    // here, the offramp tier (8–14). The override exactly covers the
    // one_question range (1–7), so life_disruption never produces it.
    expect(ladder(8, 'life_disruption', true)).toEqual({
      action: 'offramp',
      options: ['pause', 'keep_nudging', 'handoff'],
    });
  });

  it('mechanicFrictionThreshold fires above 15% hold_cancel, independent of any gap', () => {
    expect(mechanicFrictionThreshold(0.14)).toBe(false);
    expect(mechanicFrictionThreshold(0.16)).toBe(true);
  });

  it('app never contacts the partner — all 365 × signature × partner combinations', () => {
    const OFFER_ONLY = new Set(['none', 'reduce_dose', 'one_question', 'offramp', 'dormant']);
    for (let gap = 0; gap <= 365; gap++) {
      for (const sig of ALL_SIGNATURES) {
        for (const hasPartner of [true, false]) {
          const r = ladder(gap, sig, hasPartner);
          // Every response is a UI offer from the closed set above.
          // There is no 'notify', no 'send', no outbound anything —
          // and /src/partner exposes no method capable of it either
          // (see boundaries.test.ts).
          expect(OFFER_ONLY.has(r.action)).toBe(true);
          expect(JSON.stringify(r)).not.toMatch(/notify|send|sms|message_partner/i);
        }
      }
    }
  });
});

describe('reconcile() skeleton (W7 contract, fixed now)', () => {
  const countingSteps = (calls: string[]): ReconcileSteps => ({
    closeDay: (_ctx, d) => calls.push(`close:${d}`),
    attributeRewards: () => {},
    advancePhase: () => {},
    diagnose: () => {},
    updateBandit: () => {},
    checkInvariants: () => {},
  });

  it('walks each day once, advances the watermark, and re-running is a no-op', () => {
    const db = openTestDb();
    migrate(db);
    const log = new Log({ db, buildSha: 'test-sha' });
    meta.set(db, 'watermark', '2026-07-10');

    const calls: string[] = [];
    reconcile({ db, log }, countingSteps(calls), '2026-07-13');
    expect(calls).toEqual(['close:2026-07-11', 'close:2026-07-12', 'close:2026-07-13']);
    expect(meta.get(db, 'watermark')).toBe('2026-07-13');

    reconcile({ db, log }, countingSteps(calls), '2026-07-13');
    expect(calls).toHaveLength(3); // byte-identical no-op
  });

  it('does nothing before onboarding sets the watermark', () => {
    const db = openTestDb();
    migrate(db);
    const log = new Log({ db, buildSha: 'test-sha' });
    const calls: string[] = [];
    reconcile({ db, log }, countingSteps(calls), '2026-07-13');
    expect(calls).toHaveLength(0);
  });
});
