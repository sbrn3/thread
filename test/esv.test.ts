import { describe, expect, it } from 'vitest';
import { migrate } from '../src/log/schema';
import { EsvProvider, parseEsvPassage } from '../src/text/esv';
import { openTestDb } from './util/testDb';

// Fixture shaped exactly per api.esv.org/docs/passage-text/'s documented
// example: "[35] Jesus wept." — verse markers as "[N]", paragraphs
// separated by a blank line. This module's correctness against the
// REAL API is unverified (no key available); this is the only ground
// truth available to test against.
const SINGLE_VERSE = '  [35] Jesus wept.';
const MULTI_PARAGRAPH =
  '  [16] For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life. [17] For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him.\n\n' +
  '  [18] Whoever believes in him is not condemned, but whoever does not believe is condemned already, because he has not believed in the name of the only Son of God.';

describe('parseEsvPassage (documented response shape)', () => {
  it('parses a single verse', () => {
    const verses = parseEsvPassage(SINGLE_VERSE, 'john', 11);
    expect(verses).toEqual([{ book: 'john', chapter: 11, verse: 35, text: 'Jesus wept.', paragraphStart: true }]);
  });

  it('parses multiple verses across paragraphs, marking each paragraph start', () => {
    const verses = parseEsvPassage(MULTI_PARAGRAPH, 'john', 3);
    expect(verses.map((v) => v.verse)).toEqual([16, 17, 18]);
    expect(verses[0].text).toMatch(/loved the world/);
    expect(verses[0].paragraphStart).toBe(true);
    expect(verses[1].paragraphStart).toBeUndefined(); // same paragraph as 16
    expect(verses[2].paragraphStart).toBe(true); // new paragraph
  });

  it('ignores stray whitespace and returns nothing for empty input', () => {
    expect(parseEsvPassage('   \n\n  ', 'john', 3)).toEqual([]);
  });
});

describe('EsvProvider (§07/§08 — unverified against a live key)', () => {
  it('caches on read — second call needs no network', async () => {
    const db = openTestDb();
    migrate(db);
    let calls = 0;
    const fetchFn = (async (url: string) => {
      calls++;
      expect(url).toContain('api.esv.org');
      expect(url).toContain('q=John+3');
      return { ok: true, json: async () => ({ passages: [MULTI_PARAGRAPH] }) };
    }) as unknown as typeof fetch;

    const p = new EsvProvider({ apiKey: 'k', db, fetchFn, now: () => 1 });
    const first = await p.getChapter('john', 3);
    const second = await p.getChapter('john', 3);
    expect(calls).toBe(1);
    expect(first).toEqual(second);
    expect(first.map((v) => v.verse)).toEqual([16, 17, 18]);
  });

  it('sends the Crossway auth header, not query-string auth', async () => {
    const db = openTestDb();
    migrate(db);
    let headers: Record<string, string> | undefined;
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      headers = init?.headers as Record<string, string>;
      return { ok: true, json: async () => ({ passages: [SINGLE_VERSE] }) };
    }) as unknown as typeof fetch;

    await new EsvProvider({ apiKey: 'secret-key', db, fetchFn }).getChapter('john', 11);
    expect(headers?.Authorization).toBe('Token secret-key');
  });

  it('carries the required Crossway attribution notice', () => {
    const db = openTestDb();
    migrate(db);
    const p = new EsvProvider({ apiKey: 'k', db });
    expect(p.attribution()).toMatch(/Crossway/);
    expect(p.attribution()).toMatch(/English Standard Version/);
  });

  it('throws on a non-ok response rather than silently returning empty text', async () => {
    const db = openTestDb();
    migrate(db);
    const fetchFn = (async () => ({ ok: false, status: 429, json: async () => ({}) })) as unknown as typeof fetch;
    const p = new EsvProvider({ apiKey: 'k', db, fetchFn });
    await expect(p.getChapter('john', 3)).rejects.toThrow(/429/);
  });

  it('never exposes a bulk-download path — one chapter per call, by construction', () => {
    const methods = Object.getOwnPropertyNames(EsvProvider.prototype);
    expect(methods.sort()).toEqual(['attribution', 'constructor', 'getChapter'].sort());
  });
});
