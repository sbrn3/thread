import { describe, expect, it } from 'vitest';
import { getRecentErrors, logError } from '../src/errors';
import { migrate } from '../src/log/schema';
import { openTestDb } from './util/testDb';

describe('logError/getRecentErrors (§19 error log)', () => {
  it('round-trips a message and stack, stamped with build_sha', () => {
    const db = openTestDb();
    migrate(db);
    logError(db, 'boom', 'at foo (bar.ts:1:1)');

    const rows = db.all<{ message: string; stack: string; build_sha: string }>('SELECT * FROM error_log');
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toBe('boom');
    expect(rows[0].stack).toBe('at foo (bar.ts:1:1)');
    expect(rows[0].build_sha).toBeTruthy();
  });

  it('getRecentErrors returns newest first, capped at the given limit', () => {
    const db = openTestDb();
    migrate(db);
    for (let i = 0; i < 5; i++) logError(db, `error ${i}`);

    const recent = getRecentErrors(db, 3);
    expect(recent).toHaveLength(3);
    expect(recent[0].message).toBe('error 4');
    expect(recent[2].message).toBe('error 2');
  });

  it('a missing stack is stored as null, not the string "undefined"', () => {
    const db = openTestDb();
    migrate(db);
    logError(db, 'no stack here');
    expect(db.get<{ stack: string | null }>('SELECT stack FROM error_log')?.stack).toBeNull();
  });
});
