import { describe, expect, it } from 'vitest';
import { buildYearReview, computeRecoveryRate, isYearReviewDue } from '../src/lab/analysis/yearReview';
import { saveSrbai } from '../src/lab/srbai';
import { migrate } from '../src/log/schema';
import { openTestDb } from './util/testDb';

describe('isYearReviewDue (§12 R6 — once, day 365+)', () => {
  it('is not due before day 365', () => {
    const db = openTestDb();
    migrate(db);
    expect(isYearReviewDue(db, '2027-01-01', '2026-06-01', false)).toBe(false); // ~214 days in
  });

  it('is due once day 365 arrives', () => {
    const db = openTestDb();
    migrate(db);
    expect(isYearReviewDue(db, '2027-07-01', '2026-06-01', false)).toBe(true); // ~395 days in
  });

  it('is never due again once shown', () => {
    const db = openTestDb();
    migrate(db);
    expect(isYearReviewDue(db, '2028-01-01', '2026-06-01', true)).toBe(false);
  });
});

describe('computeRecoveryRate (§12 R6)', () => {
  it('is 1 (perfect) when there are no lapse episodes at all', () => {
    const db = openTestDb();
    migrate(db);
    for (const d of ['2026-07-01', '2026-07-02', '2026-07-03']) {
      db.run(`INSERT INTO days (local_date, sealed, dose) VALUES (?, 1, 'full_chapter')`, [d]);
    }
    expect(computeRecoveryRate(db)).toEqual({ episodes: 0, recoveredWithin7: 0, recoveryRate: 1 });
  });

  it('back-to-back sealed days are no episode at all', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-01', 1, 'full_chapter')`);
    db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-02', 1, 'full_chapter')`);
    expect(computeRecoveryRate(db).episodes).toBe(0);
  });

  it('counts gaps of 2+ days as episodes, and classifies recovery within 7 days', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-01', 1, 'full_chapter')`);
    db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-05', 1, 'full_chapter')`); // 4-day gap — recovers within 7
    db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-25', 1, 'full_chapter')`); // 20-day gap — does not

    const stats = computeRecoveryRate(db);
    expect(stats.episodes).toBe(2);
    expect(stats.recoveredWithin7).toBe(1);
    expect(stats.recoveryRate).toBeCloseTo(0.5);
  });
});

describe('buildYearReview', () => {
  it('produces a coherent report from a mostly-empty trial', () => {
    const db = openTestDb();
    migrate(db);
    const report = buildYearReview(db, '2027-07-01', '2026-07-01');

    expect(report.totalDays).toBeGreaterThan(360);
    expect(report.daysSealed).toBe(0);
    expect(report.hollowness).toEqual({ promoted: 0, held60: 0 });
    expect(report.verdict).toMatch(/did not take hold/);
  });

  it('reads SRBAI trend, promoted/retention, and cue strength from real data', () => {
    const db = openTestDb();
    migrate(db);
    const trialStart = '2026-01-01';
    const today = '2027-01-10'; // > 365 days later

    // A high, consistent seal rate, extending close enough to `today`
    // that the trailing-30-day cue-strength window has real data.
    for (let i = 0; i < 370; i++) {
      const d = new Date(Date.parse(`${trialStart}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
      db.run(`INSERT INTO days (local_date, sealed, sealed_before_nudge, dose) VALUES (?, 1, 1, 'full_chapter')`, [d]);
    }
    db.run(
      `INSERT INTO passages (book, chapter, verse_start, verse_end, marked_at, promoted_at, held_since)
       VALUES ('john', 3, 16, 16, 0, 0, '2026-02-01')`,
    );
    saveSrbai(db, '2026-02-01', { q1: 2, q2: 2, q3: 2, q4: 2, reflection: '' });
    saveSrbai(db, '2026-11-01', { q1: 5, q2: 5, q3: 5, q4: 5, reflection: '' });

    const report = buildYearReview(db, today, trialStart);

    expect(report.daysSealed).toBe(370);
    expect(report.hollowness.promoted).toBe(1);
    expect(report.hollowness.held60).toBe(1); // held since 2026-02-01, well past 60 days by 2027-01-10
    expect(report.srbaiTrend.map((p) => p.average)).toEqual([2, 5]);
    expect(report.cueStrengthRecent).toBe(1);
    expect(report.verdict).toMatch(/habit formed/i);
  });
});
