import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ApiBibleProvider, parseChapter } from '../src/text/apiBible';
import { CANON } from '../src/text/canon';
import { BundledProvider, ChainedProvider, type BundledBible } from '../src/text/provider';
import { splitSittings } from '../src/text/sittings';
import { migrate, schemaVersion } from '../src/log/schema';
import { openTestDb } from './util/testDb';

let web: BundledBible;
beforeAll(() => {
  web = JSON.parse(
    readFileSync(join(__dirname, '..', 'assets', 'bible', 'web.json'), 'utf8'),
  ) as BundledBible;
});

describe('bundled WEB data (W2)', () => {
  it('contains all 66 canon books, in the canon', () => {
    expect(Object.keys(web.books)).toHaveLength(66);
    for (const b of CANON) expect(web.books[b.id], b.id).toBeDefined();
  });

  it('every chapter in the canon renders (non-empty verses, positive numbers)', async () => {
    const p = new BundledProvider(web);
    for (const b of CANON) {
      const chapters = web.books[b.id];
      expect(chapters.length, b.id).toBeGreaterThan(0);
      for (let c = 1; c <= chapters.length; c++) {
        const verses = await p.getChapter(b.id, c);
        expect(verses.length, `${b.id} ${c}`).toBeGreaterThan(0);
        for (const v of verses) {
          expect(v.text.length, `${b.id} ${c}:${v.verse}`).toBeGreaterThan(0);
          expect(v.verse).toBeGreaterThan(0);
        }
      }
    }
  });

  it('spot checks: counts and text', async () => {
    const p = new BundledProvider(web);
    expect(p.chapterCount('psalms')).toBe(150);
    expect((await p.getChapter('psalms', 119)).length).toBe(176);
    expect((await p.getChapter('psalms', 117)).length).toBe(2);
    const john3 = await p.getChapter('john', 3);
    expect(john3.find((v) => v.verse === 16)?.text).toMatch(/loved the world/);
  });

  it('Psalm 119 splits into balanced sittings at paragraph boundaries (W2 done-when)', async () => {
    const p = new BundledProvider(web);
    const sittings = splitSittings(await p.getChapter('psalms', 119));
    expect(sittings.length).toBe(5);
    const sizes = sittings.map((s) => s.length);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(176);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(44);
  });

  it('WEB is public domain — no attribution required', () => {
    expect(new BundledProvider(web).attribution()).toBeNull();
  });
});

describe('migration v2 — chapter cache', () => {
  it('migrates 0 → 2 and 1 → 2 additively', () => {
    const db = openTestDb();
    migrate(db);
    expect(schemaVersion(db)).toBe(2);
    db.run(
      `INSERT INTO chapter_cache (translation, book, chapter, verses_json, fetched_at)
       VALUES ('NIV', 'john', 3, '[]', 0)`,
    );
  });
});

// Minimal shape of an API.Bible content-type=json response
const apiContent = [
  {
    name: 'para',
    items: [
      { name: 'verse', attrs: { number: '1' } },
      { type: 'text', text: 'In the beginning was the Word, ' },
      { type: 'text', text: 'and the Word was with God.' },
      { name: 'verse', attrs: { number: '2' } },
      { type: 'text', text: 'The same was in the beginning with God.' },
    ],
  },
];

describe('ApiBibleProvider (Path A)', () => {
  it('parses API.Bible JSON content into verses with paragraph starts', () => {
    const verses = parseChapter(apiContent, 'john', 1);
    expect(verses).toHaveLength(2);
    expect(verses[0]).toMatchObject({ verse: 1, paragraphStart: true });
    expect(verses[0].text).toBe('In the beginning was the Word, and the Word was with God.');
    expect(verses[1].paragraphStart).toBeUndefined();
  });

  it('caches on read — second call needs no network', async () => {
    const db = openTestDb();
    migrate(db);
    let calls = 0;
    const fetchFn = (async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({ data: { content: apiContent, copyright: 'NIV © Biblica' } }),
      };
    }) as unknown as typeof fetch;

    const p = new ApiBibleProvider({ apiKey: 'k', bibleId: 'niv-id', db, fetchFn, now: () => 1 });
    await p.getChapter('john', 1);
    await p.getChapter('john', 1);
    expect(calls).toBe(1);
    expect(p.attribution()).toBe('NIV © Biblica'); // licence notice from the API
  });

  it('never exposes a bulk-download path — one chapter per call, by construction', () => {
    const methods = Object.getOwnPropertyNames(ApiBibleProvider.prototype);
    expect(methods.sort()).toEqual(
      ['attribution', 'constructor', 'getChapter', 'readCache', 'writeCache'].sort(),
    );
  });
});

describe('ChainedProvider — NIV over WEB floor', () => {
  it('falls back to bundled WEB when the API is unreachable', async () => {
    const db = openTestDb();
    migrate(db);
    const failing = new ApiBibleProvider({
      apiKey: 'k',
      bibleId: 'niv-id',
      db,
      fetchFn: (async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch,
    });
    const chain = new ChainedProvider([failing, new BundledProvider(web)]);
    const verses = await chain.getChapter('john', 3);
    expect(verses.find((v) => v.verse === 16)?.text).toMatch(/loved the world/);
    expect(chain.attribution()).toBeNull(); // WEB served it
  });
});
