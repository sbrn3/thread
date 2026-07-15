import { describe, expect, it } from 'vitest';
import { applyRecommendation, markApplied } from '../src/lab/analysis/report';
import { getProfile, setProfile } from '../src/lab/profile';
import { migrate } from '../src/log/schema';
import { openTestDb } from './util/testDb';

describe('getProfile/setProfile', () => {
  it('round-trips a value', () => {
    const db = openTestDb();
    migrate(db);
    expect(getProfile(db, 'seal')).toBeNull();
    setProfile(db, 'seal', 'tap');
    expect(getProfile(db, 'seal')).toBe('tap');
    setProfile(db, 'seal', 'hold');
    expect(getProfile(db, 'seal')).toBe('hold');
  });
});

function seedReport(db: ReturnType<typeof openTestDb>, expId: string, verdict: 'A' | 'B' | 'none') {
  db.run(
    `INSERT INTO reports (exp_id, generated_at, verdict, effect, nap, confidence, recommendation, applied)
     VALUES (?, 0, ?, 0, 0.5, 'weak', 'rec', NULL)`,
    [expId, verdict],
  );
}

describe('applyRecommendation (§15 compiled profile, applied immediately)', () => {
  it.each([
    ['E1', 'B', 'seal', 'tap'],
    ['E1', 'A', 'seal', 'hold'],
    ['E3', 'A', 'streakVisible', '1'],
    ['E3', 'B', 'streakVisible', '0'],
    ['E4', 'B', 'floor', 'one_verse'],
    ['E4', 'A', 'floor', 'full_chapter'],
    ['E7', 'B', 'frequencyTarget', '5_per_week'],
    ['E7', 'A', 'frequencyTarget', 'daily'],
  ] as const)('%s winner %s writes profile.%s = %s', (expId, verdict, key, value) => {
    const db = openTestDb();
    migrate(db);
    seedReport(db, expId, verdict);

    applyRecommendation(db, expId);

    expect(getProfile(db, key)).toBe(value);
  });

  it('does nothing when the verdict is "none" — no winner to adopt', () => {
    const db = openTestDb();
    migrate(db);
    seedReport(db, 'E1', 'none');

    applyRecommendation(db, 'E1');

    expect(getProfile(db, 'seal')).toBeNull();
  });

  it('does nothing for an expId with no governed profile setting', () => {
    const db = openTestDb();
    migrate(db);
    seedReport(db, 'E9', 'A');

    expect(() => applyRecommendation(db, 'E9')).not.toThrow();
    expect(db.all('SELECT * FROM profile')).toHaveLength(0);
  });
});

describe('markApplied (§15 — Apply writes the profile, Keep never does)', () => {
  it('Apply (applied=true) writes the profile', () => {
    const db = openTestDb();
    migrate(db);
    seedReport(db, 'E1', 'B');

    markApplied(db, 'E1', true);

    expect(getProfile(db, 'seal')).toBe('tap');
    expect(db.get("SELECT applied FROM reports WHERE exp_id = 'E1'")).toEqual({ applied: 1 });
  });

  it('Keep (applied=false) never writes the profile', () => {
    const db = openTestDb();
    migrate(db);
    seedReport(db, 'E1', 'B');

    markApplied(db, 'E1', false);

    expect(getProfile(db, 'seal')).toBeNull();
    expect(db.get("SELECT applied FROM reports WHERE exp_id = 'E1'")).toEqual({ applied: 0 });
  });
});
