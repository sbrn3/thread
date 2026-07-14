import type { SqlDb } from '../log/db';
import { CANON } from './canon';
import type { TextProvider, Verse } from './provider';

// Path A (§07): NIV via API.Bible, free non-commercial Starter tier.
// Cache-on-read: each chapter is stored in SQLite after the first
// fetch, so re-reading is offline. Bulk-downloading the translation
// is NOT permitted by the licence — there is deliberately no method
// here that fetches more than one chapter.

// The copyright notice is a condition of the licence (§07). It is
// rendered under every chapter; the real string for the account's
// NIV entitlement comes from the API's `copyright` field and
// replaces this default on first successful fetch.
const NIV_NOTICE =
  'Scripture quotations taken from The Holy Bible, New International Version® NIV®. ' +
  'Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc. Used by permission. All rights reserved worldwide.';

export interface ApiBibleConfig {
  apiKey: string;
  /** The NIV bible id shown for your key at api.scripture.api.bible (varies per account). */
  bibleId: string;
  db: SqlDb;
  fetchFn?: typeof fetch;
  now?: () => number;
}

interface ApiContentItem {
  type?: string;
  name?: string;
  attrs?: { verseId?: string; number?: string; style?: string };
  items?: ApiContentItem[];
  text?: string;
}

export class ApiBibleProvider implements TextProvider {
  private readonly cfg: Required<Pick<ApiBibleConfig, 'apiKey' | 'bibleId' | 'db'>> &
    ApiBibleConfig;
  private notice: string = NIV_NOTICE;

  constructor(cfg: ApiBibleConfig) {
    this.cfg = cfg;
  }

  async getChapter(book: string, ch: number): Promise<Verse[]> {
    const cached = this.readCache(book, ch);
    if (cached) return cached;

    const usfm = CANON.find((b) => b.id === book)?.usfm;
    if (!usfm) throw new Error(`Unknown book id: ${book}`);

    const fetchFn = this.cfg.fetchFn ?? fetch;
    const url =
      `https://api.scripture.api.bible/v1/bibles/${this.cfg.bibleId}` +
      `/chapters/${usfm}.${ch}?content-type=json&include-notes=false&include-titles=false`;
    const res = await fetchFn(url, { headers: { 'api-key': this.cfg.apiKey } });
    if (!res.ok) throw new Error(`API.Bible ${res.status} for ${book} ${ch}`);

    const body = (await res.json()) as {
      data: { content: ApiContentItem[]; copyright?: string };
    };
    if (body.data.copyright) this.notice = body.data.copyright.trim();

    const verses = parseChapter(body.data.content, book, ch);
    if (verses.length === 0) throw new Error(`API.Bible returned no verses for ${book} ${ch}`);
    this.writeCache(book, ch, verses);
    return verses;
  }

  attribution(): string {
    return this.notice;
  }

  private readCache(book: string, ch: number): Verse[] | null {
    const row = this.cfg.db.get<{ verses_json: string }>(
      'SELECT verses_json FROM chapter_cache WHERE translation = ? AND book = ? AND chapter = ?',
      ['NIV', book, ch],
    );
    return row ? (JSON.parse(row.verses_json) as Verse[]) : null;
  }

  private writeCache(book: string, ch: number, verses: Verse[]): void {
    this.cfg.db.run(
      `INSERT INTO chapter_cache (translation, book, chapter, verses_json, fetched_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(translation, book, chapter) DO UPDATE SET
         verses_json = excluded.verses_json, fetched_at = excluded.fetched_at`,
      ['NIV', book, ch, JSON.stringify(verses), (this.cfg.now ?? Date.now)()],
    );
  }
}

/**
 * Flatten API.Bible's nested JSON content into verses. Verse starts
 * are marked by `verse` items carrying attrs.number; text accrues to
 * the current verse. Paragraph starts map from `para` blocks.
 */
export function parseChapter(content: ApiContentItem[], book: string, ch: number): Verse[] {
  const verses: Verse[] = [];
  let current: Verse | null = null;

  const walk = (items: ApiContentItem[], newParagraph: { flag: boolean }): void => {
    for (const item of items) {
      if (item.name === 'para' || item.type === 'para') newParagraph.flag = true;
      if (item.name === 'verse' && item.attrs?.number) {
        const n = Number(item.attrs.number);
        if (!Number.isNaN(n)) {
          current = { book, chapter: ch, verse: n, text: '' };
          if (newParagraph.flag) current.paragraphStart = true;
          newParagraph.flag = false;
          verses.push(current);
        }
      } else if (item.type === 'text' && item.text && current) {
        current.text = `${current.text} ${item.text}`.replace(/\s+/g, ' ').trim();
      }
      if (item.items) walk(item.items, newParagraph);
    }
  };

  walk(content, { flag: false });
  return verses.filter((v) => v.text.length > 0);
}
