import { describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate, schemaVersion } from '../src/log/schema';
import { openTestDb } from './util/testDb';

describe('schema + migration harness (W1)', () => {
  it('migrates empty → latest clean', () => {
    const db = openTestDb();
    expect(schemaVersion(db)).toBe(0);
    migrate(db);
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);

    const tables = db
      .all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .map((r) => r.name);
    for (const t of [
      'events',
      'days',
      'exp_phases',
      'decisions',
      'bandit',
      'cue',
      'passages',
      'partner',
      'srbai',
      'reports',
      'meta',
    ]) {
      expect(tables).toContain(t);
    }
  });

  it('is idempotent — running migrate twice is a no-op', () => {
    const db = openTestDb();
    migrate(db);
    migrate(db);
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
  });

  it('partner table admits exactly one row (a dyad, not a group)', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO partner (id, name) VALUES (1, 'A')`);
    expect(() => db.run(`INSERT INTO partner (id, name) VALUES (2, 'B')`)).toThrow();
  });
});
