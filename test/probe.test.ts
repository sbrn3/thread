import { describe, expect, it } from 'vitest';
import { gradeProbe, resolveTodaysProbe } from '../src/lab/probe';
import { migrate } from '../src/log/schema';
import { openTestDb } from './util/testDb';

describe('resolveTodaysProbe (§10/E9 — the next-day recall probe)', () => {
  it('returns null with nothing recorded when yesterday was never sealed', () => {
    const db = openTestDb();
    migrate(db);
    expect(resolveTodaysProbe(db, '2026-07-14', 'fixed-seed')).toBeNull();
    expect(db.get("SELECT fired FROM probes WHERE local_date = '2026-07-14'")).toEqual({ fired: 0 });
  });

  it('is deterministic and idempotent — replaying the same day never re-rolls it', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO days (local_date, sealed, dose, book, chapter, verses_read) VALUES ('2026-07-13', 1, 'full_chapter', 'john', 3, 36)`);

    const first = resolveTodaysProbe(db, '2026-07-14', 'fixed-seed');
    const second = resolveTodaysProbe(db, '2026-07-14', 'fixed-seed');
    expect(second).toEqual(first);
    expect(db.all('SELECT * FROM probes')).toHaveLength(1); // never a second row
  });

  it('when fired, carries yesterday\'s book/chapter/verses_read into the probes row', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO days (local_date, sealed, dose, book, chapter, verses_read) VALUES ('2026-07-13', 1, 'full_chapter', 'john', 3, 36)`);

    // fireRate=1 forces the fire branch deterministically, isolating this
    // assertion from weightedPick's specific seed/threshold behaviour.
    const probe = resolveTodaysProbe(db, '2026-07-14', 'fixed-seed', 1);
    expect(probe).toEqual({ book: 'john', chapter: 3 });
    const row = db.get<{ fired: number; book: string; chapter: number; verses_read: number }>(
      "SELECT fired, book, chapter, verses_read FROM probes WHERE local_date = '2026-07-14'",
    );
    expect(row).toEqual({ fired: 1, book: 'john', chapter: 3, verses_read: 36 });
  });

  it('fireRate=0 never fires', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO days (local_date, sealed, dose, book, chapter, verses_read) VALUES ('2026-07-13', 1, 'full_chapter', 'john', 3, 36)`);
    expect(resolveTodaysProbe(db, '2026-07-14', 'fixed-seed', 0)).toBeNull();
  });
});

describe('gradeProbe', () => {
  it('records the grade against that date\'s probe row', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO probes (local_date, fired, book, chapter, verses_read, grade) VALUES ('2026-07-14', 1, 'john', 3, 36, NULL)`);

    gradeProbe(db, '2026-07-14', 'held');

    expect(db.get("SELECT grade FROM probes WHERE local_date = '2026-07-14'")).toEqual({ grade: 'held' });
  });
});
