// Thin driver interface so the same SQL runs against expo-sqlite in
// the app and better-sqlite3 in the vitest simulation suite.

export type SqlParam = string | number | null;

export interface SqlDb {
  run(sql: string, params?: SqlParam[]): void;
  all<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): T | undefined;
  /** Synchronous transaction. Throwing inside rolls back. */
  tx(fn: () => void): void;
}
