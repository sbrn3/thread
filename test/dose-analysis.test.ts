import { describe, expect, it } from 'vitest';
import { analyzeDoseCurve, bestDoseArm } from '../src/lab/analysis/dose';
import { migrate } from '../src/log/schema';
import { openTestDb } from './util/testDb';

function seedDoseDay(
  db: ReturnType<typeof openTestDb>,
  date: string,
  arm: string,
  sealed: boolean,
  nextDayGrade?: 'held' | 'partial' | 'lost' | 'skipped',
) {
  db.run(`INSERT INTO days (local_date, sealed, dose) VALUES (?, ?, 'full_chapter')`, [date, sealed ? 1 : 0]);
  db.run(
    `INSERT INTO decisions (local_date, point, arm, delivered) VALUES (?, 'dose_target', ?, 1)`,
    [date, arm],
  );
  if (nextDayGrade) {
    const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    db.run(`INSERT INTO probes (local_date, fired, grade) VALUES (?, 1, ?)`, [next, nextDayGrade]);
  }
}

describe('analyzeDoseCurve (§14 E10 — composite = recall_score × seal_rate)', () => {
  it('returns a zeroed placeholder for an arm with no assigned days', () => {
    const db = openTestDb();
    migrate(db);
    const points = analyzeDoseCurve(db);
    expect(points).toHaveLength(4);
    for (const p of points) {
      expect(p.n).toBe(0);
      expect(p.composite).toBe(0);
    }
    expect(points.map((p) => p.targetVerses)).toEqual([10, 20, 30, 45]);
  });

  it('computes sealRate and recallScore per arm from real days/probes data', () => {
    const db = openTestDb();
    migrate(db);
    seedDoseDay(db, '2026-07-01', 'v20', true, 'held');
    seedDoseDay(db, '2026-07-02', 'v20', true, 'lost');
    seedDoseDay(db, '2026-07-03', 'v20', false);

    const v20 = analyzeDoseCurve(db).find((p) => p.arm === 'v20')!;
    expect(v20.n).toBe(3);
    expect(v20.sealRate).toBeCloseTo(2 / 3);
    expect(v20.recallScore).toBeCloseTo((1 + 0) / 2); // held=1, lost=0 — day 3 has no probe (unsealed, no reading to probe)
    expect(v20.composite).toBeCloseTo(v20.sealRate * v20.recallScore);
  });

  it('keeps arms independent — one arm\'s data never leaks into another\'s', () => {
    const db = openTestDb();
    migrate(db);
    seedDoseDay(db, '2026-07-01', 'v10', true, 'held');
    seedDoseDay(db, '2026-08-01', 'v45', false);

    const points = analyzeDoseCurve(db);
    expect(points.find((p) => p.arm === 'v10')?.n).toBe(1);
    expect(points.find((p) => p.arm === 'v45')?.n).toBe(1);
    expect(points.find((p) => p.arm === 'v20')?.n).toBe(0);
    expect(points.find((p) => p.arm === 'v30')?.n).toBe(0);
  });
});

describe('bestDoseArm', () => {
  it('is null when nothing has any evidence', () => {
    const db = openTestDb();
    migrate(db);
    expect(bestDoseArm(analyzeDoseCurve(db))).toBeNull();
  });

  it('picks the arm with the highest composite, ignoring arms with no evidence', () => {
    const db = openTestDb();
    migrate(db);
    seedDoseDay(db, '2026-07-01', 'v10', true, 'lost'); // composite: 1 * 0 = 0
    seedDoseDay(db, '2026-07-02', 'v30', true, 'held'); // composite: 1 * 1 = 1

    const best = bestDoseArm(analyzeDoseCurve(db));
    expect(best?.arm).toBe('v30');
  });
});
