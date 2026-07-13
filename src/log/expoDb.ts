// expo-sqlite adapter for the SqlDb driver interface. App-only:
// the vitest suite uses a better-sqlite3 adapter instead (test/util).
import * as SQLite from 'expo-sqlite';
import type { SqlDb, SqlParam } from './db';

export function openAppDb(name = 'thread.db'): SqlDb {
  const db = SQLite.openDatabaseSync(name);
  db.execSync('PRAGMA journal_mode = WAL');
  db.execSync('PRAGMA foreign_keys = ON');

  return {
    run(sql: string, params: SqlParam[] = []): void {
      // PRAGMA statements are not preparable with bound params.
      if (params.length === 0) db.execSync(sql);
      else db.runSync(sql, params);
    },
    all<T>(sql: string, params: SqlParam[] = []): T[] {
      return db.getAllSync<T>(sql, params);
    },
    get<T>(sql: string, params: SqlParam[] = []): T | undefined {
      return db.getFirstSync<T>(sql, params) ?? undefined;
    },
    tx(fn: () => void): void {
      db.withTransactionSync(fn);
    },
  };
}
