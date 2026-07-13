import Database from 'better-sqlite3';
import type { SqlDb, SqlParam } from '../../src/log/db';

/** In-memory better-sqlite3 behind the same SqlDb driver the app uses. */
export function openTestDb(): SqlDb {
  const db = new Database(':memory:');
  return {
    run(sql: string, params: SqlParam[] = []): void {
      if (params.length === 0) db.exec(sql);
      else db.prepare(sql).run(...params);
    },
    all<T>(sql: string, params: SqlParam[] = []): T[] {
      return db.prepare(sql).all(...params) as T[];
    },
    get<T>(sql: string, params: SqlParam[] = []): T | undefined {
      // better-sqlite3 requires .pragma() for PRAGMA reads
      if (/^\s*PRAGMA\s/i.test(sql)) {
        const name = sql.replace(/^\s*PRAGMA\s+/i, '').trim();
        const value = db.pragma(name, { simple: true });
        return { [name]: value } as T;
      }
      return db.prepare(sql).get(...params) as T | undefined;
    },
    tx(fn: () => void): void {
      db.transaction(fn)();
    },
  };
}
