import { describe, expect, it } from 'vitest';
import { migrate } from '../src/log/schema';
import { analyzeReversal, phaseMetrics } from '../src/lab/analysis/reversal';
import { openTestDb } from './util/testDb';

function seedPhase(db: ReturnType<typeof openTestDb>, phase: number, arm: 'A' | 'B', start: string, end: string) {
  db.run(
    `INSERT INTO exp_phases (exp_id, phase, arm, start_date, end_date, status) VALUES ('E1', ?, ?, ?, ?, 'done')`,
    [phase, arm, start, end],
  );
}

function seedDays(db: ReturnType<typeof openTestDb>, start: string, sealedCount: number, totalDays: number, disturbed = false) {
  const startDate = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    db.run(`INSERT INTO days (local_date, sealed, dose, disturbed) VALUES (?, ?, 'full_chapter', ?)`, [
      d,
      i < sealedCount ? 1 : 0,
      disturbed ? 1 : 0,
    ]);
  }
}

describe('phaseMetrics (§15 — derived from exp_phases × days, no per-event stamping)', () => {
  it('sums sealed days within each phase\'s date range', () => {
    const db = openTestDb();
    migrate(db);
    seedPhase(db, 0, 'A', '2026-01-01', '2026-01-21');
    seedDays(db, '2026-01-01', 15, 21);

    const metrics = phaseMetrics(db, 'E1');
    expect(metrics).toEqual([{ phase: 0, arm: 'A', daysSealed: 15, disturbed: false }]);
  });

  it('flags a phase disturbed if any day inside it was confounded', () => {
    const db = openTestDb();
    migrate(db);
    seedPhase(db, 0, 'A', '2026-01-01', '2026-01-21');
    seedDays(db, '2026-01-01', 15, 21, true);

    expect(phaseMetrics(db, 'E1')[0].disturbed).toBe(true);
  });
});

describe('analyzeReversal (§15)', () => {
  it('returns null when one arm has no undisturbed data yet', () => {
    const db = openTestDb();
    migrate(db);
    seedPhase(db, 0, 'A', '2026-01-01', '2026-01-21');
    seedDays(db, '2026-01-01', 15, 21);

    expect(analyzeReversal(db, 'E1')).toBeNull();
  });

  it('calls a clean, large, consistent separation strong', () => {
    const db = openTestDb();
    migrate(db);
    // ABAB: hold(A) badly underperforms tap(B) in both natural pairs.
    seedPhase(db, 0, 'A', '2026-01-01', '2026-01-21');
    seedDays(db, '2026-01-01', 12, 21);
    seedPhase(db, 1, 'B', '2026-01-22', '2026-02-11');
    seedDays(db, '2026-01-22', 20, 21);
    seedPhase(db, 2, 'A', '2026-02-12', '2026-03-04');
    seedDays(db, '2026-02-12', 11, 21);
    seedPhase(db, 3, 'B', '2026-03-05', '2026-03-25');
    seedDays(db, '2026-03-05', 19, 21);

    const report = analyzeReversal(db, 'E1')!;
    expect(report.winner).toBe('B');
    expect(report.consistentDirection).toBe(true);
    expect(report.confidence).toBe('strong');
  });

  it('is inconclusive when the arms barely differ', () => {
    const db = openTestDb();
    migrate(db);
    seedPhase(db, 0, 'A', '2026-01-01', '2026-01-21');
    seedDays(db, '2026-01-01', 15, 21);
    seedPhase(db, 1, 'B', '2026-01-22', '2026-02-11');
    seedDays(db, '2026-01-22', 15, 21);

    const report = analyzeReversal(db, 'E1')!;
    expect(report.confidence).toBe('inconclusive');
  });

  it('detects a monotonic trend and never calls it strong even with separation', () => {
    const db = openTestDb();
    migrate(db);
    // Strictly rising across all 4 phases regardless of arm — habit
    // formation, not a treatment effect.
    seedPhase(db, 0, 'A', '2026-01-01', '2026-01-21');
    seedDays(db, '2026-01-01', 5, 21);
    seedPhase(db, 1, 'B', '2026-01-22', '2026-02-11');
    seedDays(db, '2026-01-22', 10, 21);
    seedPhase(db, 2, 'A', '2026-02-12', '2026-03-04');
    seedDays(db, '2026-02-12', 15, 21);
    seedPhase(db, 3, 'B', '2026-03-05', '2026-03-25');
    seedDays(db, '2026-03-05', 20, 21);

    const report = analyzeReversal(db, 'E1')!;
    expect(report.trend).toBe('monotonic');
    expect(report.confidence).not.toBe('strong');
  });

  it('excludes a disturbed phase from the verdict computation', () => {
    const db = openTestDb();
    migrate(db);
    seedPhase(db, 0, 'A', '2026-01-01', '2026-01-21');
    seedDays(db, '2026-01-01', 2, 21, true); // disturbed — should not count toward A's mean
    seedPhase(db, 1, 'B', '2026-01-22', '2026-02-11');
    seedDays(db, '2026-01-22', 18, 21);
    seedPhase(db, 2, 'A', '2026-02-12', '2026-03-04');
    seedDays(db, '2026-02-12', 12, 21);

    const report = analyzeReversal(db, 'E1')!;
    expect(report.meanA).toBe(12); // only the undisturbed A phase counts
    expect(report.phases.find((p) => p.phase === 0)?.disturbed).toBe(true);
  });
});
