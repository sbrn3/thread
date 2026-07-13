import type { Verse } from './provider';

// §04 — chapters over the threshold (default 40 verses) split into
// sittings: "Psalm 119 · sitting 2 of 4". Computed at book-selection
// time and stored; the reader never has to decide.

export type Sitting = Verse[];

const SEARCH_RADIUS = 6; // how far a cut may slide to land on a paragraph start

/**
 * §13.4 — balanced, not 40/40/40/40/16 (176 → 5 sittings), and cuts
 * land on paragraph boundaries when one is nearby: never split
 * mid-thought.
 */
export function splitSittings(verses: Verse[], max = 40): Sitting[] {
  if (verses.length <= max) return [verses];

  const n = Math.ceil(verses.length / max);
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
