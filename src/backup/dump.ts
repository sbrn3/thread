import type { SqlDb } from '../log/db';

// §16.9 — the log is the irreplaceable asset; a cache isn't.
// chapter_cache is deliberately excluded: it's re-fetchable from the
// text provider, and there's no reason to duplicate licensed NIV/ESV
// text into another file on disk.
export const BACKUP_TABLES = [
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
  'state',
  'probes',
  'profile',
  'meta',
] as const;

export interface BackupDump {
  formatVersion: 1;
  exportedAt: number;
  tables: Record<string, Record<string, unknown>[]>;
}

/** Every included table's rows, verbatim. No transformation — restore is the only path back, so fidelity matters more than compactness. */
export function buildDump(db: SqlDb, now: () => number = Date.now): BackupDump {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of BACKUP_TABLES) {
    tables[table] = db.all(`SELECT * FROM ${table}`);
  }
  return { formatVersion: 1, exportedAt: now(), tables };
}

/**
 * Wipes and repopulates every included table from the dump, in one
 * transaction. Column-intersection per row: a dump from an older
 * schema (fewer columns) inserts cleanly into a newer one (extra
 * columns default to NULL); a dump with columns the current schema
 * doesn't have simply drops them, rather than failing the whole
 * restore. `migrate()` should already have run on this db before
 * calling this — restoring never migrates on its own.
 */
export function restoreDump(db: SqlDb, dump: BackupDump): void {
  if (dump.formatVersion !== 1) {
    throw new Error(`Unsupported backup format version: ${dump.formatVersion}`);
  }

  db.tx(() => {
    for (const table of BACKUP_TABLES) {
      const rows = dump.tables[table] ?? [];
      db.run(`DELETE FROM ${table}`);
      if (rows.length === 0) continue;

      const liveColumns = new Set(db.all<{ name: string }>(`PRAGMA table_info(${table})`).map((c) => c.name));
      for (const row of rows) {
        const columns = Object.keys(row).filter((c) => liveColumns.has(c));
        if (columns.length === 0) continue;
        const placeholders = columns.map(() => '?').join(', ');
        db.run(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          columns.map((c) => row[c] as never),
        );
      }
    }
  });
}
