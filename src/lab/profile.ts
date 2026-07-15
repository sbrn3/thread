import type { SqlDb } from '../log/db';

/**
 * §15 "the engine can be overruled," made concrete: a small applied-
 * settings profile, written the moment a report is Applied (see
 * analysis/report.ts's applyRecommendation), read by whichever
 * component each experiment actually governs. Values are always
 * strings — callers own their own parsing/defaulting, same as `meta`.
 */
export function getProfile(db: SqlDb, key: string): string | null {
  return db.get<{ value: string }>('SELECT value FROM profile WHERE key = ?', [key])?.value ?? null;
}

export function setProfile(db: SqlDb, key: string, value: string): void {
  db.run(
    'INSERT INTO profile (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}
