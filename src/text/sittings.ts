import type { TextProvider, Verse } from './provider';

// §04 — chapters over the threshold (default 40 verses) split into
// sittings: "Psalm 119 · sitting 2 of 4". Computed at book-selection
// time and stored; the reader never has to decide.

export type Sitting = Verse[];

const SEARCH_RADIUS = 6; // how far a cut may slide to land on a paragraph start

/**
 * §13.4/§16.5 — balanced, not 40/40/40/40/16 (176 → 5 sittings), and
 * cuts land on paragraph boundaries when one is nearby: never split
 * mid-thought. The no-split threshold is `target * 1.5`, not `target`
 * itself — a 41-verse chapter against a 40-verse target shouldn't
 * produce a near-useless 21/20 split.
 */
export function splitSittings(verses: Verse[], target = 40): Sitting[] {
  if (verses.length <= target * 1.5) return [verses];

  const n = Math.ceil(verses.length / target);
  const size = Math.ceil(verses.length / n);

  const cuts: number[] = [];
  let prev = 0;
  for (let i = 1; i < n; i++) {
    const ideal = Math.min(i * size, verses.length - 1);
    cuts.push(nearestParagraphCut(verses, ideal, prev + 1));
    prev = cuts[cuts.length - 1];
  }

  const out: Sitting[] = [];
  let start = 0;
  for (const cut of [...cuts, verses.length]) {
    out.push(verses.slice(start, cut));
    start = cut;
  }
  return out.filter((s) => s.length > 0);
}

/** Index to cut BEFORE — the verse at the returned index starts the next sitting. */
function nearestParagraphCut(verses: Verse[], ideal: number, min: number): number {
  let best = ideal;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let d = 0; d <= SEARCH_RADIUS; d++) {
    for (const idx of [ideal - d, ideal + d]) {
      if (idx <= min - 1 || idx >= verses.length) continue;
      if (verses[idx].paragraphStart && d < bestDist) {
        best = idx;
        bestDist = d;
      }
    }
    if (bestDist <= d) break;
  }
  return Math.max(best, min);
}

export interface DailyPortion {
  sittings: Sitting[];
  /** WEB-canon chapter numbers included, in order — length 1 unless a merge occurred. */
  chapters: number[];
}

/**
 * §21.2 — "the dose is the unit; the chapter is not." With no fixed
 * target (`target === null`, the seed default before E10/the lapse
 * ladder exist), this is exactly today's chapter, split as usual. With
 * a real target, a chapter already at or above it is only ever split,
 * same as before — but a chapter SHORTER than the target merges
 * forward with the next ones, uncut, until the target is met or the
 * book ends, rather than sealing a 2-verse day identically to a
 * 40-verse one. Extra verses from a merge are read honestly but don't
 * get sub-split across days — reading ahead never banks credit for
 * tomorrow (§21.2), so the next call simply starts fresh one chapter
 * past the last one merged in.
 */
export async function buildDailyPortion(
  text: TextProvider,
  book: string,
  chapter: number,
  totalChapters: number,
  target: number | null,
): Promise<DailyPortion> {
  const first = await text.getChapter(book, chapter);
  if (target === null || first.length >= target) {
    return { sittings: splitSittings(first, target ?? 40), chapters: [chapter] };
  }

  let verses = first;
  const chapters = [chapter];
  let next = chapter;
  while (verses.length < target && next < totalChapters) {
    next += 1;
    verses = verses.concat(await text.getChapter(book, next));
    chapters.push(next);
  }
  return { sittings: [verses], chapters };
}
