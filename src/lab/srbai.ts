import type { SqlDb } from '../log/db';

// §09/§19 — SRBAI (Self-Report Behavioural Automaticity Index),
// reworded to measure INITIATION, not the reading itself: whether
// opening the app has become automatic, independent of whether that
// day's reading happened. The one signal outside the behavioural
// apparatus — everything else in this app is inferred from logs;
// this is the only thing it ever just asks.
export const SRBAI_QUESTIONS = [
  'Reading my Bible is something I do automatically.',
  "Reading my Bible is something I start before I've decided to.",
  "Reading my Bible is something that would feel strange to skip.",
  'Reading my Bible is something I do without having to remember to.',
] as const;

export interface SrbaiAnswers {
  q1: number; // 1-5, strongly disagree to strongly agree
  q2: number;
  q3: number;
  q4: number;
  reflection: string; // the "formational line" — one line, free text
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Due once per calendar month — never re-asked once answered this month. */
export function isSrbaiDue(db: SqlDb, date: string): boolean {
  const row = db.get('SELECT 1 FROM srbai WHERE local_date >= ?', [monthStart(date)]);
  return !row;
}

export function saveSrbai(db: SqlDb, date: string, answers: SrbaiAnswers): void {
  db.run(
    `INSERT INTO srbai (local_date, q1, q2, q3, q4, reflection) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(local_date) DO UPDATE SET
       q1 = excluded.q1, q2 = excluded.q2, q3 = excluded.q3, q4 = excluded.q4, reflection = excluded.reflection`,
    [date, answers.q1, answers.q2, answers.q3, answers.q4, answers.reflection],
  );
}

/**
 * §19 "the monthly eyeball" — a plain list of every date the app
 * believes you read, shown alongside the SRBAI prompt. Deliberately
 * not a chart: a chart can be subtly wrong and still look plausible;
 * a list of dates is checkable against memory in ten seconds.
 */
export function eyeballDates(db: SqlDb, date: string): string[] {
  return db
    .all<{ local_date: string }>(
      'SELECT local_date FROM days WHERE sealed = 1 AND local_date >= ? AND local_date <= ? ORDER BY local_date DESC',
      [monthStart(date), date],
    )
    .map((r) => r.local_date);
}

export interface SrbaiTrendPoint {
  month: string; // 'YYYY-MM'
  average: number; // mean of q1-q4, 1-5
}

/** §12 R6 — the SRBAI-initiation curve across months, oldest first. */
export function srbaiTrend(db: SqlDb): SrbaiTrendPoint[] {
  return db
    .all<{ local_date: string; q1: number; q2: number; q3: number; q4: number }>(
      'SELECT local_date, q1, q2, q3, q4 FROM srbai ORDER BY local_date ASC',
    )
    .map((r) => ({ month: r.local_date.slice(0, 7), average: (r.q1 + r.q2 + r.q3 + r.q4) / 4 }));
}
