import { describe, expect, it } from 'vitest';
import { Log } from '../src/log/log';
import { migrate } from '../src/log/schema';
import { Memory } from '../src/memory/memory';
import { openTestDb } from './util/testDb';

function setup() {
  const db = openTestDb();
  migrate(db);
  const log = new Log({ db, buildSha: 'test-sha' });
  const memory = new Memory(db, log);
  return { db, log, memory };
}

describe('Memory (§13.3 /src/memory, §21)', () => {
  it('marks a candidate and logs candidate_marked — no text stored', () => {
    const { db, memory } = setup();
    memory.markCandidate({ book: 'john', chapter: 3, verseStart: 16, verseEnd: 16 }, () => 1000);

    const candidates = memory.candidates('john');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ book: 'john', chapter: 3, verse_start: 16, verse_end: 16 });
    expect((candidates[0] as unknown as Record<string, unknown>).text).toBeUndefined();

    const event = db.get<{ type: string }>("SELECT * FROM events WHERE type = 'candidate_marked'");
    expect(event?.type).toBe('candidate_marked');
  });

  it('unmarkCandidate retracts a tap — the candidate is gone, not just hidden', () => {
    const { db, memory } = setup();
    const ref = { book: 'john', chapter: 3, verseStart: 16, verseEnd: 16 };
    memory.markCandidate(ref, () => 1);
    expect(memory.candidates('john')).toHaveLength(1);

    memory.unmarkCandidate(ref);

    expect(memory.candidates('john')).toHaveLength(0);
    expect(db.all('SELECT * FROM passages')).toHaveLength(0);
  });

  it('re-marking the same verse after unmarking does not leave duplicates', () => {
    const { memory } = setup();
    const ref = { book: 'john', chapter: 3, verseStart: 16, verseEnd: 16 };
    memory.markCandidate(ref, () => 1);
    memory.unmarkCandidate(ref);
    memory.markCandidate(ref, () => 2);

    expect(memory.candidates('john')).toHaveLength(1);
  });

  it('unmarkCandidate never touches a promoted passage, even for the same reference', () => {
    const { memory } = setup();
    const ref = { book: 'john', chapter: 3, verseStart: 16, verseEnd: 16 };
    memory.markCandidate(ref, () => 1);
    const [{ id }] = memory.candidates('john');
    memory.promote(id, '2026-07-14');

    memory.unmarkCandidate(ref);

    // Promoted passages aren't returned by candidates(); confirm via due().
    expect(memory.due('2026-07-14')).toHaveLength(1);
  });

  it('candidates() only returns unpromoted marks for that book', () => {
    const { db, memory } = setup();
    memory.markCandidate({ book: 'john', chapter: 3, verseStart: 16, verseEnd: 16 }, () => 1);
    memory.markCandidate({ book: 'john', chapter: 1, verseStart: 1, verseEnd: 1 }, () => 2);
    memory.markCandidate({ book: 'romans', chapter: 8, verseStart: 28, verseEnd: 28 }, () => 3);

    expect(memory.candidates('john')).toHaveLength(2);
    expect(memory.candidates('romans')).toHaveLength(1);

    const [{ id }] = memory.candidates('romans');
    memory.promote(id, '2026-07-14');
    expect(memory.candidates('romans')).toHaveLength(0); // promoted, no longer a candidate
    void db;
  });

  it('promote() rejects a second promoted passage for the same book', () => {
    const { memory } = setup();
    memory.markCandidate({ book: 'john', chapter: 3, verseStart: 16, verseEnd: 16 }, () => 1);
    memory.markCandidate({ book: 'john', chapter: 1, verseStart: 1, verseEnd: 1 }, () => 2);
    const [first, second] = memory.candidates('john');

    memory.promote(second.id, '2026-07-14');
    expect(() => memory.promote(first.id, '2026-07-14')).toThrow(/already has a promoted passage/);
  });

  it('promote() throws for an unknown id', () => {
    const { memory } = setup();
    expect(() => memory.promote(999, '2026-07-14')).toThrow(/No such passage/);
  });

  it('due() returns promoted passages at or before the date, caller caps at 2', () => {
    const { memory } = setup();
    memory.markCandidate({ book: 'john', chapter: 3, verseStart: 16, verseEnd: 16 }, () => 1);
    const [{ id }] = memory.candidates('john');
    memory.promote(id, '2026-07-01');

    expect(memory.due('2026-07-01')).toHaveLength(1); // due immediately on promotion day
    expect(memory.due('2026-06-30')).toHaveLength(0);
  });

  it('grade() reschedules via the Leitner boxes and logs recall_graded', () => {
    const { db, memory } = setup();
    memory.markCandidate({ book: 'john', chapter: 3, verseStart: 16, verseEnd: 16 }, () => 1);
    const [{ id }] = memory.candidates('john');
    memory.promote(id, '2026-07-01');

    memory.grade(id, 'held', '2026-07-01');
    const due = memory.due('2026-07-04'); // box 2 → +3 days
    expect(due).toHaveLength(1);
    expect(due[0].box).toBe(2);
    expect(due[0].last_grade).toBe('held');

    const graded = db.all("SELECT * FROM events WHERE type = 'recall_graded'");
    expect(graded).toHaveLength(1);
  });

  it('grade() is a dead end for lost — back to box 1, due tomorrow', () => {
    const { memory } = setup();
    memory.markCandidate({ book: 'john', chapter: 3, verseStart: 16, verseEnd: 16 }, () => 1);
    const [{ id }] = memory.candidates('john');
    memory.promote(id, '2026-07-01');
    memory.grade(id, 'held', '2026-07-01'); // box 2
    memory.grade(id, 'lost', '2026-07-04'); // box 1

    expect(memory.due('2026-07-05')[0].box).toBe(1);
  });

  it('retention() counts passages held (box 5) for at least 60 days', () => {
    const { memory } = setup();
    memory.markCandidate({ book: 'john', chapter: 3, verseStart: 16, verseEnd: 16 }, () => 1);
    const [{ id }] = memory.candidates('john');
    memory.promote(id, '2026-01-01');
    // Fast-forward through boxes 2..5 with 'held' grades.
    memory.grade(id, 'held', '2026-01-01'); // box 2
    memory.grade(id, 'held', '2026-01-05'); // box 3
    memory.grade(id, 'held', '2026-01-15'); // box 4
    memory.grade(id, 'held', '2026-02-01'); // box 5, held_since = 2026-02-01

    expect(memory.retention('2026-02-15')).toEqual({ promoted: 1, held60: 0 }); // only 14 days
    expect(memory.retention('2026-04-05')).toEqual({ promoted: 1, held60: 1 }); // 63 days
  });

  it('marksPerChapter — the E4 secondary metric — divides marks by sealed chapters in range', () => {
    const { db, log, memory } = setup();
    // Two sealed chapters in range, three marks in range, one mark outside.
    db.run(
      `INSERT INTO days (local_date, sealed, book, chapter, dose) VALUES
       ('2026-07-01', 1, 'john', 1, 'full_chapter'),
       ('2026-07-02', 1, 'john', 2, 'full_chapter')`,
    );
    const ts = (dateUtcNoon: string) => Date.parse(dateUtcNoon);
    memory.markCandidate({ book: 'john', chapter: 1, verseStart: 1, verseEnd: 1 }, () => ts('2026-07-01T12:00:00Z'));
    memory.markCandidate({ book: 'john', chapter: 1, verseStart: 3, verseEnd: 3 }, () => ts('2026-07-01T13:00:00Z'));
    memory.markCandidate({ book: 'john', chapter: 2, verseStart: 5, verseEnd: 5 }, () => ts('2026-07-02T12:00:00Z'));
    memory.markCandidate({ book: 'john', chapter: 3, verseStart: 1, verseEnd: 1 }, () => ts('2026-06-01T12:00:00Z')); // outside range

    expect(memory.marksPerChapter('2026-07-01', '2026-07-02')).toBe(1.5); // 3 marks / 2 chapters
    void log;
  });

  it('a failed recall provably touches nothing: seal/streak/weave/dose are byte-identical for held vs lost (§13.5 W6a)', () => {
    const OTHER_TABLES = ['days', 'cue', 'bandit', 'decisions', 'exp_phases', 'srbai', 'reports', 'meta', 'partner'];

    function run(grade: 'held' | 'lost') {
      const db = openTestDb();
      migrate(db);
      const log = new Log({ db, buildSha: 'test-sha' });
      const memory = new Memory(db, log);

      db.run(
        `INSERT INTO days (local_date, sealed, sealed_before_nudge, book, chapter, dose)
         VALUES ('2026-07-14', 1, 1, 'john', 3, 'full_chapter')`,
      );
      db.run(`INSERT INTO cue (anchor, place, nudge_hour, set_at, active) VALUES ('coffee', 'chair', 21, 0, 1)`);

      memory.markCandidate({ book: 'john', chapter: 3, verseStart: 16, verseEnd: 16 }, () => 1);
      const [{ id }] = memory.candidates('john');
      memory.promote(id, '2026-07-01');
      memory.grade(id, grade, '2026-07-14');

      return OTHER_TABLES.map((t) => db.all(`SELECT * FROM ${t}`));
    }

    expect(JSON.stringify(run('held'))).toBe(JSON.stringify(run('lost')));
  });
});
