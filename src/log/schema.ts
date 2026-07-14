import type { SqlDb } from './db';

// §13.2 — the complete schema, single source of truth.
// Migrations are ADDITIVE-ONLY; a migration that drops a column
// deletes evidence. Bump user_version per migration, never rewrite
// history.

const V1: string[] = [
  // append-only. Never UPDATE, never DELETE.
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    ts INTEGER NOT NULL,
    tz_offset INTEGER NOT NULL,
    local_date TEXT NOT NULL,
    type TEXT NOT NULL,
    book TEXT,
    chapter INTEGER,
    sitting INTEGER,
    duration_ms INTEGER,
    scroll_pct REAL,
    before_nudge INTEGER,
    exp_id TEXT,
    exp_arm TEXT,
    build_sha TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_events_date ON events(local_date)`,
  `CREATE INDEX IF NOT EXISTS idx_events_type ON events(type, local_date)`,

  // one row per day, written by closeDay(). Derived, rebuildable
  // from events at any time.
  `CREATE TABLE IF NOT EXISTS days (
    local_date TEXT PRIMARY KEY,
    sealed INTEGER NOT NULL,
    sealed_before_nudge INTEGER,
    book TEXT,
    chapter INTEGER,
    sitting INTEGER,
    dose TEXT NOT NULL,
    exp_id TEXT,
    exp_arm TEXT,
    disturbed INTEGER DEFAULT 0,
    build_sha TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS exp_phases (
    exp_id TEXT,
    phase INTEGER,
    arm TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT,
    disturbed INTEGER DEFAULT 0,
    PRIMARY KEY (exp_id, phase)
  )`,

  // MRT + bandit decision points (§16.3)
  `CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY,
    ts INTEGER,
    local_date TEXT,
    point TEXT,
    ctx TEXT,
    arm TEXT,
    explored INTEGER,
    delivered INTEGER DEFAULT 0,
    reward INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS bandit (
    arm TEXT,
    bucket TEXT,
    alpha REAL,
    beta REAL,
    n_obs INTEGER,
    last_cp TEXT,
    PRIMARY KEY (arm, bucket)
  )`,

  // current + history. Changes are confounds (§17).
  `CREATE TABLE IF NOT EXISTS cue (
    id INTEGER PRIMARY KEY,
    anchor TEXT,
    place TEXT,
    nudge_hour INTEGER,
    set_at INTEGER,
    active INTEGER
  )`,

  // §21. Candidates + the promoted one per book.
  // One promoted passage per book — enforced in code, not schema:
  // promote() rejects if a promoted row already exists for that book.
  `CREATE TABLE IF NOT EXISTS passages (
    id INTEGER PRIMARY KEY,
    book TEXT,
    chapter INTEGER,
    verse_start INTEGER,
    verse_end INTEGER,
    marked_at INTEGER,
    promoted_at INTEGER,
    box INTEGER DEFAULT 1,
    due_date TEXT,
    last_grade TEXT,
    held_since TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_passages_due
     ON passages(due_date) WHERE promoted_at IS NOT NULL`,

  // §15 hand-off. Local only. Never synced. There is no partner_state,
  // no last_contacted, no streak. The log is DELIBERATELY BLINDED here.
  `CREATE TABLE IF NOT EXISTS partner (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    name TEXT,
    contact_ref TEXT,
    convo_anchor TEXT,
    convo_day INTEGER
  )`,

  // monthly automaticity (§09)
  `CREATE TABLE IF NOT EXISTS srbai (
    local_date TEXT PRIMARY KEY,
    q1 INTEGER, q2 INTEGER, q3 INTEGER, q4 INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS reports (
    exp_id TEXT PRIMARY KEY,
    generated_at INTEGER,
    verdict TEXT,
    effect REAL,
    nap REAL,
    confidence TEXT,
    recommendation TEXT,
    applied INTEGER
  )`,

  // watermark · trial_seed · trial_start · dose · dormant_until
  // invariant_failed · last_export · build_sha
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
];

// v2 — chapter cache for the API.Bible provider (§07 Path A).
// Cache-on-read only; a cache, not evidence — but still additive.
const V2: string[] = [
  `CREATE TABLE IF NOT EXISTS chapter_cache (
    translation TEXT NOT NULL,
    book TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verses_json TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (translation, book, chapter)
  )`,
];

// Index = schema version - 1. New migrations append; nothing is edited.
export const MIGRATIONS: string[][] = [V1, V2];

export function migrate(db: SqlDb): void {
  const row = db.get<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.tx(() => {
      for (const stmt of MIGRATIONS[v]) db.run(stmt);
      db.run(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

export function schemaVersion(db: SqlDb): number {
  return db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
}
