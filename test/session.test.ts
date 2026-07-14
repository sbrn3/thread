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

function setup() {
  const db = openTestDb();
  migrate(db);
  const log = new Log({ db, buildSha: 'test-sha' });
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
    sealedToday: false,
    attribution: null,
    daysInBook: 1,
    justFinishedBook: null,
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

  it('re-seeds next_book after consuming it, so the queue stays one deep', async () => {
    const { db, log, text } = setup();
    meta.set(db, 'current_book', 'philemon');
    meta.set(db, 'current_chapter', '1');
    meta.set(db, 'current_sitting', '0');
    meta.set(db, 'book_started_local_date', '2026-07-14');
    meta.set(db, 'next_book', 'james');

    await useSession.getState().load(db, log, text, '2026-07-14');
    await useSession.getState().seal(db, log, text, '2026-07-14');

    expect(meta.get(db, 'current_book')).toBe('james');
    expect(meta.get(db, 'next_book')).not.toBeNull();
    expect(meta.get(db, 'next_book')).not.toBe('james'); // re-seeded to something after james, not left stale
  });

  it('falls back to canon order when next_book was never queued (defensive path)', async () => {
    const { db, log, text } = setup();
    meta.set(db, 'current_book', 'philemon');
    meta.set(db, 'current_chapter', '1');
    meta.set(db, 'current_sitting', '0');
    meta.set(db, 'book_started_local_date', '2026-07-14');
    // next_book deliberately left unset

    await useSession.getState().load(db, log, text, '2026-07-14');
    await useSession.getState().seal(db, log, text, '2026-07-14');

    expect(meta.get(db, 'current_book')).toBe('hebrews'); // canon order after Philemon
  });
});
