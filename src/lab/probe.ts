import type { SqlDb } from '../log/db';
import { addDays } from '../log/time';
import { weightedPick } from './mrt';

export interface DailyProbe {
  book: string;
  chapter: number;
}

export type ProbeGrade = 'held' | 'partial' | 'lost' | 'skipped';

/**
 * §10/E9 — the next-day recall probe: "Yesterday you read Philippians
 * 3. What do you remember?" Randomized daily, p=0.6 by default
 * (Phase 3 lets an applied report change the rate). Decided once per
 * day and persisted immediately — idempotent on replay/re-render, so
 * revisiting the arrival zone can never re-roll it. Returns null when
 * there's nothing to probe (yesterday wasn't sealed) or the roll came
 * up 'skip'.
 */
export function resolveTodaysProbe(db: SqlDb, date: string, trialSeed: string, fireRate = 0.6): DailyProbe | null {
  const existing = db.get<{ fired: number; book: string | null; chapter: number | null }>(
    'SELECT fired, book, chapter FROM probes WHERE local_date = ?',
    [date],
  );
  if (existing) {
    return existing.fired && existing.book && existing.chapter
      ? { book: existing.book, chapter: existing.chapter }
      : null;
  }

  const yesterday = addDays(date, -1);
  const priorDay = db.get<{ sealed: number; book: string | null; chapter: number | null; verses_read: number | null }>(
    'SELECT sealed, book, chapter, verses_read FROM days WHERE local_date = ?',
    [yesterday],
  );

  if (!priorDay?.sealed || !priorDay.book || !priorDay.chapter) {
    db.run(
      'INSERT INTO probes (local_date, fired, book, chapter, verses_read, grade) VALUES (?, 0, NULL, NULL, NULL, NULL)',
      [date],
    );
    return null;
  }

  const arm = weightedPick(trialSeed, `E9:${date}`, { fire: fireRate, skip: 1 - fireRate });
  db.run(
    'INSERT INTO probes (local_date, fired, book, chapter, verses_read, grade) VALUES (?, ?, ?, ?, ?, NULL)',
    [date, arm === 'fire' ? 1 : 0, priorDay.book, priorDay.chapter, priorDay.verses_read],
  );

  return arm === 'fire' ? { book: priorDay.book, chapter: priorDay.chapter } : null;
}

export function gradeProbe(db: SqlDb, date: string, grade: ProbeGrade): void {
  db.run('UPDATE probes SET grade = ? WHERE local_date = ?', [grade, date]);
}
