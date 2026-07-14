import type { SqlDb } from '../log/db';
import { bookName } from './canon';
import { readCachedChapter, writeCachedChapter } from './chapterCache';
import type { TextProvider, Verse } from './provider';

// Path B (§07/§08 updated plan): ESV via api.esv.org. A genuinely
// different API from API.Bible — its own auth scheme, and a
// documented cap of 500 verses / half a book per query, which this
// module never approaches (one chapter per call).
//
// UNVERIFIED AGAINST A LIVE KEY: this integration was built from
// published API documentation (api.esv.org/docs/passage-text/), not
// exercised against a real account — there was no key available to
// test with. The parser (parseEsvPassage) is unit-tested against the
// documented response shape. Smoke-test this against a real key
// before relying on it; see README.

const ESV_NOTICE =
  'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), ' +
  'copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. ' +
  'All rights reserved.';

export interface EsvConfig {
  apiKey: string;
  db: SqlDb;
  fetchFn?: typeof fetch;
  now?: () => number;
}

export class EsvProvider implements TextProvider {
  constructor(private readonly cfg: EsvConfig) {}

  async getChapter(book: string, ch: number): Promise<Verse[]> {
    const cached = readCachedChapter(this.cfg.db, 'ESV', book, ch);
    if (cached) return cached;

    const name = bookName(book); // ESV's API takes plain English references, e.g. "1 Corinthians 13"
    const fetchFn = this.cfg.fetchFn ?? fetch;
    const params = new URLSearchParams({
      q: `${name} ${ch}`,
      'include-verse-numbers': 'true',
      'include-footnotes': 'false',
      'include-footnote-body': 'false',
      'include-headings': 'false',
      'include-passage-references': 'false',
      'include-short-copyright': 'false',
      'include-copyright': 'false',
    });
    const res = await fetchFn(`https://api.esv.org/v3/passage/text/?${params}`, {
      headers: { Authorization: `Token ${this.cfg.apiKey}` },
    });
    if (!res.ok) throw new Error(`ESV API ${res.status} for ${book} ${ch}`);

    const body = (await res.json()) as { passages?: string[] };
    const text = body.passages?.[0];
    if (!text) throw new Error(`ESV API returned no passage for ${book} ${ch}`);

    const verses = parseEsvPassage(text, book, ch);
    if (verses.length === 0) throw new Error(`ESV API: no verses parsed for ${book} ${ch}`);
    writeCachedChapter(this.cfg.db, 'ESV', book, ch, verses, this.cfg.now);
    return verses;
  }

  attribution(): string {
    return ESV_NOTICE;
  }
}

/**
 * ESV's passage/text endpoint returns one prose string per query with
 * verse numbers inlined as "[16]" and paragraphs separated by a blank
 * line — not clean per-verse JSON. Split on blank lines for paragraph
 * boundaries, then split each paragraph on the verse markers.
 */
export function parseEsvPassage(text: string, book: string, chapter: number): Verse[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const verses: Verse[] = [];
  for (const para of paragraphs) {
    const parts = para.split(/\[(\d+)\]\s*/);
    // parts alternates: [leading junk (usually empty), num, text, num, text, ...]
    for (let i = 1; i < parts.length; i += 2) {
      const verse = Number(parts[i]);
      const verseText = parts[i + 1]?.trim().replace(/\s+/g, ' ');
      if (!verse || !verseText) continue;
      verses.push({ book, chapter, verse, text: verseText, ...(i === 1 ? { paragraphStart: true } : {}) });
    }
  }
  return verses;
}
