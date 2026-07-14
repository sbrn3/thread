import { describe, expect, it } from 'vitest';
import { migrate } from '../src/log/schema';
import { markApplied, renderMrtReport, renderReversalReport, saveReversalReport } from '../src/lab/analysis/report';
import type { MrtReport } from '../src/lab/analysis/mrt';
import type { ReversalReport } from '../src/lab/analysis/reversal';
import { openTestDb } from './util/testDb';

const SAMPLE_REVERSAL: ReversalReport = {
  expId: 'E1',
  phases: [
    { phase: 0, arm: 'A', daysSealed: 15, disturbed: false },
    { phase: 1, arm: 'B', daysSealed: 20, disturbed: false },
    { phase: 2, arm: 'A', daysSealed: 14, disturbed: false },
    { phase: 3, arm: 'B', daysSealed: 21, disturbed: false },
  ],
  meanA: 14.5,
  meanB: 20.5,
  nap: 0,
  randomizationExtremity: 0.05,
  trend: 'none',
  consistentDirection: true,
  winner: 'B',
  confidence: 'strong',
};

describe('renderReversalReport (§15 report anatomy)', () => {
  it('names the experiment using known arm labels (E1: Hold vs Tap)', () => {
    const text = renderReversalReport(SAMPLE_REVERSAL);
    expect(text).toContain('EXPERIMENT E1 · HOLD-TO-SEAL');
    expect(text).toContain('VERDICT       Tap outperformed Hold.');
    expect(text).toContain('Hold 14.5 days/phase');
    expect(text).toContain('Tap 20.5 days/phase');
    expect(text).toContain('CONFIDENCE    Strong.');
  });

  it('falls back to generic A/B labels for an unknown experiment id', () => {
    const text = renderReversalReport({ ...SAMPLE_REVERSAL, expId: 'E99' });
    expect(text).toContain('EXPERIMENT E99 · E99');
    expect(text).toContain('VERDICT       B outperformed A.');
  });

  it('reports "no difference" when there is no winner', () => {
    const text = renderReversalReport({ ...SAMPLE_REVERSAL, winner: null });
    expect(text).toContain('VERDICT       No difference detected.');
  });

  it('surfaces disturbed-phase count when any exist', () => {
    const text = renderReversalReport({
      ...SAMPLE_REVERSAL,
      phases: [...SAMPLE_REVERSAL.phases.slice(0, 3), { ...SAMPLE_REVERSAL.phases[3], disturbed: true }],
    });
    expect(text).toContain('1 flagged disturbed');
  });
});

describe('renderMrtReport', () => {
  it('never claims strong confidence in its own text', () => {
    const mrt: MrtReport = {
      point: 'nudge_hour',
      overall: [
        { arm: 'anchor_echo', n: 40, rewardRate: 0.6 },
        { arm: 'silence', n: 40, rewardRate: 0.55 },
      ],
      moderation: [],
      confidence: 'weak',
    };
    const text = renderMrtReport(mrt);
    expect(text).not.toMatch(/CONFIDENCE\s+Strong/);
    expect(text).toContain('CONFIDENCE       Weak.');
  });
});

describe('saveReversalReport / markApplied (§15 — the engine can be overruled)', () => {
  it('persists a report and lets the user accept or overrule it, once', () => {
    const db = openTestDb();
    migrate(db);

    saveReversalReport(db, SAMPLE_REVERSAL, 'Replace hold-to-seal with a single tap.', () => 1000);

    const row = db.get<{ verdict: string; confidence: string; applied: number | null }>(
      "SELECT verdict, confidence, applied FROM reports WHERE exp_id = 'E1'",
    );
    expect(row?.verdict).toBe('B');
    expect(row?.confidence).toBe('strong');
    expect(row?.applied).toBeNull(); // not yet responded

    markApplied(db, 'E1', false); // "Keep the hold anyway"

    expect(db.get<{ applied: number }>("SELECT applied FROM reports WHERE exp_id = 'E1'")?.applied).toBe(0);
  });

  it('regenerating the same experiment\'s report does not reset the user\'s prior answer', () => {
    const db = openTestDb();
    migrate(db);
    saveReversalReport(db, SAMPLE_REVERSAL, 'Replace hold-to-seal with a single tap.', () => 1000);
    markApplied(db, 'E1', true);

    saveReversalReport(db, SAMPLE_REVERSAL, 'Replace hold-to-seal with a single tap.', () => 2000);

    expect(db.get<{ applied: number }>("SELECT applied FROM reports WHERE exp_id = 'E1'")?.applied).toBe(1);
  });
});
