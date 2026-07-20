import { describe, expect, it } from 'vitest';
import { getAmendmentLog } from '../src/lab/analysis/amendments';
import { migrate } from '../src/log/schema';
import { openTestDb } from './util/testDb';

describe('getAmendmentLog (§19 — the amendment log is the changelog)', () => {
  it('is empty with nothing applied and no build changes', () => {
    const db = openTestDb();
    migrate(db);
    expect(getAmendmentLog(db)).toEqual([]);
  });

  it('ignores reports never responded to (applied IS NULL)', () => {
    const db = openTestDb();
    migrate(db);
    db.run(
      `INSERT INTO reports (exp_id, generated_at, verdict, effect, nap, confidence, recommendation, applied)
       VALUES ('E1', 100, 'B', 1, 0.9, 'strong', 'Replace hold-to-seal with a tap.', NULL)`,
    );
    expect(getAmendmentLog(db)).toEqual([]);
  });

  it('includes applied and kept reports, and build_changed events, sorted chronologically', () => {
    const db = openTestDb();
    migrate(db);
    db.run(
      `INSERT INTO reports (exp_id, generated_at, verdict, effect, nap, confidence, recommendation, applied)
       VALUES ('E4', 300, 'B', 1, 0.9, 'strong', 'Lower the floor.', 1)`,
    );
    db.run(
      `INSERT INTO reports (exp_id, generated_at, verdict, effect, nap, confidence, recommendation, applied)
       VALUES ('E3', 100, 'A', 1, 0.9, 'strong', 'Show the streak.', 0)`,
    );
    db.run(
      `INSERT INTO events (ts, tz_offset, local_date, type, build_sha) VALUES (200, 0, '2026-07-14', 'build_changed', 'abc123')`,
    );

    const log = getAmendmentLog(db);
    expect(log.map((e) => e.kind)).toEqual(['kept', 'build', 'applied']);
    expect(log[0].text).toBe('E3: Kept — Show the streak.');
    expect(log[1].text).toBe('Build changed to abc123');
    expect(log[2].text).toBe('E4: Applied — Lower the floor.');
  });
});
