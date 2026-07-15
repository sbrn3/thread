import { beforeEach, describe, expect, it } from 'vitest';
import { Log, meta } from '../src/log/log';
import { migrate } from '../src/log/schema';
import { useSession } from '../src/state/session';
import type { TextProvider, Verse } from '../src/text/provider';
import { openTestDb } from './util/testDb';

// A tiny fake canon: every book has exactly 2 chapters of 1 short
// verse each, so book_finish is reachable in two seals.
function fakeText(): TextProvider {
  return {
    async getChapter(book: string, ch: number): Promise<Verse[]> {
      return [{ book, chapter: ch, verse: 1, text: `${book} ${ch}:1` }];
    },
    attribution: () => null,
  };
}

function setup(now: () => number = () => Date.parse('2026-07-14T12:00:00Z')) {
  const db = openTestDb();
  migrate(db);
  const log = new Log({ db, buildSha: 'test-sha', now });
  const text = fakeText();
  return { db, log, text };
}

beforeEach(() => {
  useSession.setState({
    loading: true,
    book: 'genesis',
    chapter: 1,
    sittingIndex: 0,
    sittings: [],
    portionChapters: [],
    sealedToday: false,
    attribution: null,
    daysInBook: 1,
    justFinishedBook: null,
    nextBookNeeded: false,
  });
});

describe('session store — book selection (§05 onboarding-set, defensive fallback)', () => {
  it('load() defaults to Genesis and logs book_start only when onboarding never set a book', async () => {
    const { db, log, text } = setup();
    await useSession.getState().load(db, log, text, '2026-07-14');

    expect(useSession.getState().book).toBe('genesis');
    const starts = db.all("SELECT * FROM events WHERE type = 'book_start'");
    expect(starts).toHaveLength(1);
  });

  it('load() picks up onboarding-set current_book without defaulting', async () => {
    const { db, log, text } = setup();
    meta.set(db, 'current_book', 'philippians');
    meta.set(db, 'current_chapter', '1');
    meta.set(db, 'current_sitting', '0');
    meta.set(db, 'book_started_local_date', '2026-07-14');

    await useSession.getState().load(db, log, text, '2026-07-14');

    expect(useSession.getState().book).toBe('philippians');
    expect(db.all("SELECT * FROM events WHERE type = 'book_start'")).toHaveLength(0); // onboarding already logged it
  });

  // Philemon is a real 1-chapter book in the bundled canon, so a
  // single seal exhausts it and triggers book_finish — bundledChapterCount()
  // reads the actual WEB data, not anything the fake TextProvider controls.
  it('seal() through book_finish consumes the onboarding-queued next_book, not canon order', async () => {
    const { db, log, text } = setup();
    meta.set(db, 'current_book', 'philemon');
    meta.set(db, 'current_chapter', '1');
    meta.set(db, 'current_sitting', '0');
    meta.set(db, 'book_started_local_date', '2026-07-14');
    meta.set(db, 'next_book', 'james'); // queued at onboarding — deliberately NOT canon-adjacent to Philemon

    await useSession.getState().load(db, log, text, '2026-07-14');
    await useSession.getState().seal(db, log, text, '2026-07-14'); // ch1 is Philemon's only chapter -> book_finish -> james

    expect(useSession.getState().justFinishedBook).toBe('philemon');
    expect(useSession.getState().book).toBe('philemon'); // seal() only updates meta; the store's `book` reflects the last load()
    expect(meta.get(db, 'current_book')).toBe('james');
    expect(meta.get(db, 'current_chapter')).toBe('1');
  });

  it('clears the queue after consuming it and flags nextBookNeeded — the user picks, the app never auto-refills', async () => {
    const { db, log, text } = setup();
    meta.set(db, 'current_book', 'philemon');
    meta.set(db, 'current_chapter', '1');
    meta.set(db, 'current_sitting', '0');
    meta.set(db, 'book_started_local_date', '2026-07-14');
    meta.set(db, 'next_book', 'james');

    await useSession.getState().load(db, log, text, '2026-07-14');
    expect(useSession.getState().nextBookNeeded).toBe(false); // queue was full before finishing

    await useSession.getState().seal(db, log, text, '2026-07-14');

    expect(meta.get(db, 'current_book')).toBe('james');
    expect(meta.get(db, 'next_book')).toBeFalsy(); // consumed, not silently re-filled
    expect(useSession.getState().nextBookNeeded).toBe(true);
  });

  it('pickNextBook fills the queue and clears nextBookNeeded', async () => {
    const { db, log, text } = setup();
    meta.set(db, 'current_book', 'philemon');
    meta.set(db, 'current_chapter', '1');
    meta.set(db, 'current_sitting', '0');
    meta.set(db, 'book_started_local_date', '2026-07-14');
    meta.set(db, 'next_book', 'james');

    await useSession.getState().load(db, log, text, '2026-07-14');
    await useSession.getState().seal(db, log, text, '2026-07-14');
    expect(useSession.getState().nextBookNeeded).toBe(true);

    useSession.getState().pickNextBook(db, 'romans');

    expect(meta.get(db, 'next_book')).toBe('romans');
    expect(useSession.getState().nextBookNeeded).toBe(false);
  });

  it('nextBookNeeded persists across a load() — a skipped pick isn\'t forgotten the next day', async () => {
    const { db, log, text } = setup();
    meta.set(db, 'current_book', 'james'); // as if book_finish already ran and next_book was left empty
    meta.set(db, 'current_chapter', '1');
    meta.set(db, 'current_sitting', '0');
    meta.set(db, 'book_started_local_date', '2026-07-14');

    await useSession.getState().load(db, log, text, '2026-07-15');
    expect(useSession.getState().nextBookNeeded).toBe(true);
  });

  it('falls back to canon order for the CURRENT book when next_book was never queued (defensive path only)', async () => {
    const { db, log, text } = setup();
    meta.set(db, 'current_book', 'philemon');
    meta.set(db, 'current_chapter', '1');
    meta.set(db, 'current_sitting', '0');
    meta.set(db, 'book_started_local_date', '2026-07-14');
    // next_book deliberately left unset

    await useSession.getState().load(db, log, text, '2026-07-14');
    await useSession.getState().seal(db, log, text, '2026-07-14');

    expect(meta.get(db, 'current_book')).toBe('hebrews'); // canon order after Philemon
    expect(useSession.getState().nextBookNeeded).toBe(true); // still needs a real pick going forward
  });
});

describe('session store — verse-normalized dose (§07, Phase 1)', () => {
  it('seal() logs the sitting\'s verse count, and deriveDayRow carries it onto the days row', async () => {
    const { db, log, text } = setup(); // fakeText's chapters are 1 verse each
    meta.set(db, 'current_book', 'genesis');
    meta.set(db, 'current_chapter', '1');
    meta.set(db, 'current_sitting', '0');
    meta.set(db, 'book_started_local_date', '2026-07-14');

    await useSession.getState().load(db, log, text, '2026-07-14');
    await useSession.getState().seal(db, log, text, '2026-07-14');

    const day = db.get<{ verses_read: number; target_verses: number | null }>(
      "SELECT verses_read, target_verses FROM days WHERE local_date = '2026-07-14'",
    );
    expect(day?.verses_read).toBe(1); // fakeText's chapters are exactly 1 verse
    expect(day?.target_verses).toBeNull(); // seed mode — todaysTarget() is null until Phase 2/4
  });
});
