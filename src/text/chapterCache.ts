import type { SqlDb } from '../log/db';
import type { Verse } from './provider';

// Shared cache-on-read helper for licensed providers (§07 Path A).
// One row per (translation, book, chapter); never bulk-populated.

export function readCachedChapter(db: SqlDb, translation: string, book: string, ch: number): Verse[] | null {
  const row = db.get<{ verses_json: string }>(
    'SELECT verses_json FROM chapter_cache WHERE translation = ? AND book = ? AND chapter = ?',
    [translation, book, ch],
  );
  return row ? (JSON.parse(row.verses_json) as Verse[]) : null;
}

export function writeCachedChapter(
  db: SqlDb,
  translation: string,
  book: string,
  ch: number,
  verses: Verse[],
  now: () => number = Date.now,
): void {
  db.run(
    `INSERT INTO chapter_cache (translation, book, chapter, verses_json, fetched_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(translation, book, chapter) DO UPDATE SET
       verses_json = excluded.verses_json, fetched_at = excluded.fetched_at`,
    [translation, book, ch, JSON.stringify(verses), now()],
  );
}
