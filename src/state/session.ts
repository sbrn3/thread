import { create } from 'zustand';
import { meta } from '../log/log';
import type { Log } from '../log/log';
import type { SqlDb } from '../log/db';
import { CANON, nextBook } from '../text/canon';
import { bundledChapterCount } from '../text';
import type { TextProvider, Verse } from '../text/provider';
import { splitSittings, type Sitting } from '../text/sittings';

// §04 — one book at a time. Onboarding (§05) requires picking both a
// current book and a next one before it can complete, so by the time
// this ever runs, current_book/next_book are already set — the
// Genesis/canon-order fallbacks below are a defensive backstop for
// onboarding-bypassed states (tests), not the primary path.

export interface SessionState {
  loading: boolean;
  book: string;
  chapter: number;
  sittingIndex: number;
  sittings: Sitting[];
  sealedToday: boolean;
  attribution: string | null;
  daysInBook: number;
  justFinishedBook: string | null; // set for one render after book_finish, for the dismissal copy

  load(db: SqlDb, log: Log, text: TextProvider, today: string): Promise<void>;
  seal(db: SqlDb, log: Log, text: TextProvider, today: string): Promise<void>;
}

function daysBetweenInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

async function loadSittings(text: TextProvider, book: string, chapter: number): Promise<Sitting[]> {
  const verses: Verse[] = await text.getChapter(book, chapter);
  return splitSittings(verses);
}

export const useSession = create<SessionState>((set, get) => ({
  loading: true,
  book: CANON[0].id,
  chapter: 1,
  sittingIndex: 0,
  sittings: [],
  sealedToday: false,
  attribution: null,
  daysInBook: 1,
  justFinishedBook: null,

  async load(db, log, text, today) {
    set({ loading: true });

    let book = meta.get(db, 'current_book');
    let chapter = Number(meta.get(db, 'current_chapter') ?? '1');
    let sittingIndex = Number(meta.get(db, 'current_sitting') ?? '0');
    let bookStarted = meta.get(db, 'book_started_local_date');

    if (!book) {
      book = CANON[0].id;
      chapter = 1;
      sittingIndex = 0;
      bookStarted = today;
      meta.set(db, 'current_book', book);
      meta.set(db, 'current_chapter', String(chapter));
      meta.set(db, 'current_sitting', String(sittingIndex));
      meta.set(db, 'book_started_local_date', bookStarted);
      log.write({ type: 'book_start', book, chapter });
    }

    const sittings = await loadSittings(text, book, chapter);
    const clampedIndex = Math.min(sittingIndex, sittings.length - 1);

    const days = log.daysBetween(today, today);
    const sealedToday = days[0]?.sealed === 1;

    set({
      loading: false,
      book,
      chapter,
      sittingIndex: clampedIndex,
      sittings,
      sealedToday,
      attribution: text.attribution(),
      daysInBook: daysBetweenInclusive(bookStarted ?? today, today),
      justFinishedBook: null,
    });
  },

  async seal(db, log, text, today) {
    const { book, chapter, sittingIndex, sittings } = get();

    log.write({
      type: 'seal',
      book,
      chapter,
      sitting: sittingIndex,
      before_nudge: 1, // no nudge system yet — always "before" until W6b
    });
    log.rebuildDays(today);

    let nextChapter = chapter;
    let nextSittingIndex = sittingIndex;
    let nextBookId = book;
    let finishedBook: string | null = null;
    let bookStarted = meta.get(db, 'book_started_local_date') ?? today;

    if (sittingIndex + 1 < sittings.length) {
      nextSittingIndex = sittingIndex + 1;
    } else {
      const totalChapters = bundledChapterCount(book);
      if (chapter < totalChapters) {
        nextChapter = chapter + 1;
        nextSittingIndex = 0;
      } else {
        log.write({ type: 'book_finish', book, chapter });
        finishedBook = book;
        // §05 onboarding queues the next book one deep; consume it
        // here. Canon order is only a defensive fallback for the
        // onboarding-bypassed case (see module comment above).
        const queued = meta.get(db, 'next_book');
        const next = queued ?? nextBook(book)?.id ?? null;
        nextBookId = next ?? book; // stays on the last book if the canon is exhausted
        nextChapter = 1;
        nextSittingIndex = 0;
        bookStarted = today;
        if (next) {
          log.write({ type: 'book_start', book: nextBookId, chapter: 1 });
          // Re-seed the queue so it stays one deep — a placeholder
          // pick (canon order) until the dismissal zone offers a real
          // re-pick, which is deferred past this pass.
          const reseed = nextBook(nextBookId)?.id;
          if (reseed) meta.set(db, 'next_book', reseed);
        }
      }
    }

    meta.set(db, 'current_book', nextBookId);
    meta.set(db, 'current_chapter', String(nextChapter));
    meta.set(db, 'current_sitting', String(nextSittingIndex));
    meta.set(db, 'book_started_local_date', bookStarted);

    set({ sealedToday: true, justFinishedBook: finishedBook });
  },
}));
