import { describe, expect, it } from 'vitest';
import { todaysTarget } from '../src/lab/dose';
import type { TextProvider, Verse } from '../src/text/provider';
import { buildDailyPortion, splitSittings } from '../src/text/sittings';
import { openTestDb } from './util/testDb';

function chapterOf(book: string, chapter: number, count: number): Verse[] {
  return Array.from({ length: count }, (_, i) => ({
    book,
    chapter,
    verse: i + 1,
    text: `${book} ${chapter}:${i + 1}`,
  }));
}

/** A book whose chapter lengths are given explicitly, keyed by chapter number. */
function fakeText(chapters: Record<number, number>): TextProvider {
  return {
    async getChapter(book, ch) {
      const count = chapters[ch];
      if (count === undefined) throw new Error(`no such chapter: ${book} ${ch}`);
      return chapterOf(book, ch, count);
    },
    attribution: () => null,
  };
}

describe('splitSittings threshold (§16.5)', () => {
  it('does not split a chapter up to target*1.5 — unlike a target-only threshold', () => {
    expect(splitSittings(chapterOf('x', 1, 60), 40)).toHaveLength(1);
  });

  it('still splits well beyond target*1.5', () => {
    expect(splitSittings(chapterOf('x', 1, 100), 40).length).toBeGreaterThan(1);
  });
});

describe('buildDailyPortion (§21.2 — "the dose is the unit; the chapter is not")', () => {
  it('seed mode (target=null): behaves exactly like today\'s chapter alone, split as usual', async () => {
    const text = fakeText({ 1: 176 }); // Psalm 119-sized
    const portion = await buildDailyPortion(text, 'psalms', 1, 150, null);
    expect(portion.chapters).toEqual([1]);
    expect(portion.sittings.length).toBe(5); // matches splitSittings(verses, 40) default exactly
  });

  it('a chapter already at/above the target is only ever split, never merged', async () => {
    const text = fakeText({ 1: 50 });
    const portion = await buildDailyPortion(text, 'x', 1, 10, 25);
    expect(portion.chapters).toEqual([1]);
  });

  it('merges short chapters forward until the target is met', async () => {
    const text = fakeText({ 1: 2, 2: 3, 3: 30 }); // Psalm-117-like short chapters, then a normal one
    const portion = await buildDailyPortion(text, 'psalms', 1, 150, 25);
    expect(portion.chapters).toEqual([1, 2, 3]); // 2+3=5 (<25), +30=35 (>=25) — stops after ch3
    expect(portion.sittings).toHaveLength(1);
    expect(portion.sittings[0]).toHaveLength(35);
  });

  it('merging stops at the book boundary even short of the target', async () => {
    const text = fakeText({ 1: 2, 2: 3 }); // a 2-chapter book, both short
    const portion = await buildDailyPortion(text, 'philemon', 1, 2, 25);
    expect(portion.chapters).toEqual([1, 2]); // never reaches 25, but the book ends
    expect(portion.sittings[0]).toHaveLength(5);
  });

  it('never loses or duplicates a verse across a merge', async () => {
    const text = fakeText({ 1: 2, 2: 3, 3: 4 });
    const portion = await buildDailyPortion(text, 'x', 1, 5, 8);
    const verses = portion.sittings.flat();
    expect(verses).toHaveLength(9);
    expect(verses.map((v) => `${v.chapter}:${v.verse}`)).toEqual([
      '1:1', '1:2', '2:1', '2:2', '2:3', '3:1', '3:2', '3:3', '3:4',
    ]);
  });
});

describe('todaysTarget (§16.5 resolution order — Phase 1 stub)', () => {
  it('returns null (seed mode) until Phase 2 (E10) / Phase 4 (lapse ladder) exist', () => {
    const db = openTestDb();
    expect(todaysTarget(db, '2026-07-14')).toBeNull();
  });
});
