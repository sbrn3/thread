import { describe, expect, it } from 'vitest';
import { eyeballDates, isSrbaiDue, saveSrbai, srbaiTrend } from '../src/lab/srbai';
import { migrate } from '../src/log/schema';
import { openTestDb } from './util/testDb';

describe('isSrbaiDue (§09/§19 — once per calendar month)', () => {
  it('is due when nothing has ever been answered', () => {
    const db = openTestDb();
    migrate(db);
    expect(isSrbaiDue(db, '2026-07-14')).toBe(true);
  });

  it('is not due again the same month it was answered', () => {
    const db = openTestDb();
    migrate(db);
    saveSrbai(db, '2026-07-05', { q1: 4, q2: 4, q3: 3, q4: 5, reflection: 'good month' });
    expect(isSrbaiDue(db, '2026-07-28')).toBe(false);
  });

  it('is due again the following month', () => {
    const db = openTestDb();
    migrate(db);
    saveSrbai(db, '2026-06-05', { q1: 4, q2: 4, q3: 3, q4: 5, reflection: '' });
    expect(isSrbaiDue(db, '2026-07-01')).toBe(true);
  });
});

describe('saveSrbai', () => {
  it('round-trips answers, and re-saving the same month updates rather than duplicating', () => {
    const db = openTestDb();
    migrate(db);
    saveSrbai(db, '2026-07-05', { q1: 3, q2: 3, q3: 3, q4: 3, reflection: 'first' });
    saveSrbai(db, '2026-07-05', { q1: 5, q2: 5, q3: 5, q4: 5, reflection: 'revised' });

    const rows = db.all('SELECT * FROM srbai');
    expect(rows).toHaveLength(1);
    expect(db.get<{ reflection: string }>("SELECT reflection FROM srbai WHERE local_date = '2026-07-05'")?.reflection).toBe(
      'revised',
    );
  });
});

describe('eyeballDates (§19 — a checkable list, not a chart)', () => {
  it('lists sealed dates within the current month only, most recent first', () => {
    const db = openTestDb();
    migrate(db);
    for (const d of ['2026-06-30', '2026-07-01', '2026-07-05', '2026-07-14']) {
      db.run(`INSERT INTO days (local_date, sealed, dose) VALUES (?, 1, 'full_chapter')`, [d]);
    }
    db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-07-10', 0, 'full_chapter')`); // unsealed — excluded

    expect(eyeballDates(db, '2026-07-14')).toEqual(['2026-07-14', '2026-07-05', '2026-07-01']);
  });
});

describe('srbaiTrend (§12 R6 — the SRBAI-initiation curve)', () => {
  it('averages q1-4 per month, oldest first', () => {
    const db = openTestDb();
    migrate(db);
    saveSrbai(db, '2026-05-05', { q1: 2, q2: 2, q3: 2, q4: 2, reflection: '' });
    saveSrbai(db, '2026-06-05', { q1: 4, q2: 4, q3: 4, q4: 4, reflection: '' });

    expect(srbaiTrend(db)).toEqual([
      { month: '2026-05', average: 2 },
      { month: '2026-06', average: 4 },
    ]);
  });
});
