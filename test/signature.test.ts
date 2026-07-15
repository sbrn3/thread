import { describe, expect, it } from 'vitest';
import { buildSignatureContext, classifySignature, type SignatureContext } from '../src/lab/signature';
import { migrate } from '../src/log/schema';
import { openTestDb } from './util/testDb';

function ctx(overrides: Partial<SignatureContext> = {}): SignatureContext {
  return {
    recentSealRate: 0.8,
    priorSealRate: 0.8,
    holdCancelRate: 0,
    opensWithoutSeals: 0,
    scrollStallRate: 0,
    currentBookSealRate: null,
    previousBookSealRate: null,
    cueStrengthRecent: null,
    cueStrengthPrior: null,
    ...overrides,
  };
}

describe('classifySignature (§11 — precedence over the raw data)', () => {
  it('mechanic_friction wins outright, regardless of anything else', () => {
    expect(classifySignature(ctx({ holdCancelRate: 0.5, recentSealRate: 0 }))).toBe('mechanic_friction');
  });

  it('life_disruption: healthy before, total silence now, no mechanic friction', () => {
    expect(classifySignature(ctx({ priorSealRate: 0.8, recentSealRate: 0 }))).toBe('life_disruption');
  });

  it('book_fatigue: previous book was healthy, current book has collapsed', () => {
    expect(
      classifySignature(ctx({ previousBookSealRate: 0.9, currentBookSealRate: 0.2, recentSealRate: 0.5 })),
    ).toBe('book_fatigue');
  });

  it('cue_collapse: cue strength fell sharply', () => {
    expect(
      classifySignature(ctx({ cueStrengthPrior: 0.8, cueStrengthRecent: 0.3, recentSealRate: 0.5 })),
    ).toBe('cue_collapse');
  });

  it('dose_too_high: opens without seals, and most of them stall mid-chapter', () => {
    expect(
      classifySignature(ctx({ opensWithoutSeals: 3, scrollStallRate: 0.7, recentSealRate: 0.5 })),
    ).toBe('dose_too_high');
  });

  it('drift: the default when nothing sharper explains the gap', () => {
    expect(classifySignature(ctx())).toBe('drift');
  });

  it('precedence: mechanic_friction beats a simultaneous life_disruption-shaped context', () => {
    expect(
      classifySignature(ctx({ holdCancelRate: 0.5, priorSealRate: 0.9, recentSealRate: 0 })),
    ).toBe('mechanic_friction');
  });
});

describe('buildSignatureContext (real queries against a fresh db)', () => {
  it('returns a context classifySignature can consume without throwing, on an empty log', () => {
    const db = openTestDb();
    migrate(db);
    expect(() => classifySignature(buildSignatureContext(db, '2026-07-14'))).not.toThrow();
    expect(classifySignature(buildSignatureContext(db, '2026-07-14'))).toBe('drift');
  });

  it('picks up a real hold_cancel-heavy window as mechanic_friction', () => {
    const db = openTestDb();
    migrate(db);
    for (let i = 0; i < 5; i++) {
      db.run(`INSERT INTO events (ts, tz_offset, local_date, type, build_sha) VALUES (0, 0, '2026-07-10', 'hold_cancel', 't')`);
    }
    db.run(`INSERT INTO events (ts, tz_offset, local_date, type, build_sha) VALUES (0, 0, '2026-07-10', 'seal', 't')`);
    expect(classifySignature(buildSignatureContext(db, '2026-07-14'))).toBe('mechanic_friction');
  });
});
