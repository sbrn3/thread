import type { SqlDb } from '../log/db';
import type { Log } from '../log/log';
import { logicalDate } from '../log/time';
import type { Grade, Passage } from '../log/types';
import { reschedule } from './leitner';

export interface PassageRef {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number; // a RANGE — meaning rarely stops at a verse (§21)
}

// §13.3 /src/memory contract. HARD RULE (§13.6): this module imports
// nothing from /src/lab or the seal/dose stores — a recall grade
// cannot, by construction, affect the reading habit.
export class Memory {
  constructor(
    private readonly db: SqlDb,
    private readonly log: Log,
  ) {}

  /** A tap while reading. No text is stored — only the reference. */
  markCandidate(r: PassageRef, now: () => number = Date.now): void {
    this.db.run(
      `INSERT INTO passages (book, chapter, verse_start, verse_end, marked_at, box)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [r.book, r.chapter, r.verseStart, r.verseEnd, now()],
    );
    this.log.write({ type: 'candidate_marked', book: r.book, chapter: r.chapter });
  }

  candidates(book: string): Passage[] {
    return this.db.all<Passage>(
      'SELECT * FROM passages WHERE book = ? AND promoted_at IS NULL ORDER BY marked_at DESC',
      [book],
    );
  }

  /** One promoted passage per book — throws if this book already has one (§13.2). */
  promote(id: number, today: string, now: () => number = Date.now): void {
    const row = this.db.get<Passage>('SELECT * FROM passages WHERE id = ?', [id]);
    if (!row) throw new Error(`No such passage: ${id}`);

    const existing = this.db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM passages WHERE book = ? AND promoted_at IS NOT NULL',
      [row.book],
    );
    if ((existing?.c ?? 0) > 0) throw new Error(`${row.book} already has a promoted passage`);

    this.db.run('UPDATE passages SET promoted_at = ?, due_date = ? WHERE id = ?', [now(), today, id]);
    this.log.write({ type: 'passage_promoted', book: row.book, chapter: row.chapter });
  }

  /** Caller caps at DAILY_RECALL_CAP; the zone does not render when nothing is due. */
  due(date: string): Passage[] {
    return this.db.all<Passage>(
      'SELECT * FROM passages WHERE promoted_at IS NOT NULL AND due_date <= ? ORDER BY due_date',
      [date],
    );
  }

  grade(id: number, g: Grade, today: string): void {
    const row = this.db.get<Passage>('SELECT * FROM passages WHERE id = ?', [id]);
    if (!row) throw new Error(`No such passage: ${id}`);
    const next = reschedule(row, g, today);
    this.db.run(
      'UPDATE passages SET box = ?, last_grade = ?, due_date = ?, held_since = ? WHERE id = ?',
      [next.box, next.last_grade, next.due_date, next.held_since, id],
    );
    this.log.write({ type: 'recall_graded', book: row.book, chapter: row.chapter });
  }

  /** §12 R6 hollowness check — passages held (box 5) for at least 60 days. */
  retention(today: string): { promoted: number; held60: number } {
    const row = this.db.get<{ promoted: number; held60: number }>(
      `SELECT
         COUNT(*) AS promoted,
         SUM(CASE WHEN held_since IS NOT NULL AND julianday(?) - julianday(held_since) >= 60
                  THEN 1 ELSE 0 END) AS held60
       FROM passages WHERE promoted_at IS NOT NULL`,
      [today],
    );
    return { promoted: row?.promoted ?? 0, held60: row?.held60 ?? 0 };
  }

  /**
   * E4 secondary metric (§10) — did a low completion bar make the
   * reading shallow? Bucketed by logical (4 AM boundary) date in JS
   * rather than SQLite's date(), which would assume UTC midnight.
   */
  marksPerChapter(from: string, to: string): number {
    const marksInRange = this.db
      .all<Passage>('SELECT * FROM passages')
      .filter((p) => {
        const d = logicalDate(p.marked_at);
        return d >= from && d <= to;
      }).length;

    const chapters = this.db.get<{ c: number }>(
      `SELECT COUNT(DISTINCT book || '-' || chapter) as c
         FROM days WHERE local_date BETWEEN ? AND ? AND sealed = 1`,
      [from, to],
    );
    if (!chapters || chapters.c === 0) return 0;
    return marksInRange / chapters.c;
  }
}
