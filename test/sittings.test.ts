import { describe, expect, it } from 'vitest';
import type { Verse } from '../src/text/provider';
import { splitSittings } from '../src/text/sittings';

function verses(n: number, paragraphEvery?: number): Verse[] {
  return Array.from({ length: n }, (_, i) => ({
    book: 'Psalms',
    chapter: 119,
    verse: i + 1,
    text: `v${i + 1}`,
    paragraphStart: paragraphEvery ? i % paragraphEvery === 0 : undefined,
  }));
}

describe('splitSittings (§04, §13.4)', () => {
  it('leaves short chapters whole', () => {
    expect(splitSittings(verses(2))).toHaveLength(1); // Psalm 117
    expect(splitSittings(verses(40))).toHaveLength(1); // exactly at threshold
  });

  it('Psalm 119 (176 verses) splits into 5 balanced sittings', () => {
    const sittings = splitSittings(verses(176));
    expect(sittings).toHaveLength(5);
    const sizes = sittings.map((s) => s.length);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(176);
    // balanced, not 40/40/40/40/16
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(8);
    expect(Math.min(...sizes)).toBeGreaterThan(20);
  });

  it('never loses or duplicates a verse', () => {
    for (const n of [41, 66, 89, 150, 176]) {
      const flat = splitSittings(verses(n, 8)).flat();
      expect(flat.map((v) => v.verse)).toEqual(verses(n).map((v) => v.verse));
    }
  });

  it('cuts land on paragraph starts when one is nearby', () => {
    // Paragraphs every 8 verses: every cut should start a paragraph.
    const sittings = splitSittings(verses(176, 8));
    for (const s of sittings.slice(1)) {
      expect(s[0].paragraphStart).toBe(true);
    }
  });
});
