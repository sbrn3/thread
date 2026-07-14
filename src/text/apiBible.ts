import { meta } from '../log/log';
import type { SqlDb } from '../log/db';
import { CANON } from './canon';
import { readCachedChapter, writeCachedChapter } from './chapterCache';
import type { TextProvider, Verse } from './provider';

// Path A (§07): NIV via API.Bible, free non-commercial Starter tier.
// Cache-on-read: each chapter is stored in SQLite after the first
// fetch, so re-reading is offline. Bulk-downloading the translation
// is NOT permitted by the licence — there is deliberately no method
// here that fetches more than one chapter.
//
// Base host verified against docs.api.bible (2026-07-14): rest.api.bible.
// An earlier version of this file used api.scripture.api.bible, which
// is wrong — fixed here rather than left to fail silently into the
// WEB fallback forever.

const API_BASE = 'https://rest.api.bible/v1';

// The copyright notice is a condition of the licence (§07). It is
// rendered under every chapter; the real string for the account's
// NIV entitlement comes from the API's `copyright` field and
// replaces this default on first successful fetch.
const NIV_NOTICE =
  'Scripture quotations taken from The Holy Bible, New International Version® NIV®. ' +
  'Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc. Used by permission. All rights reserved worldwide.';

export interface ApiBibleConfig {
  apiKey: string; // onboarding collects only this — the NIV bible id is resolved from it, not asked for
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
  private notice: string = NIV_NOTICE;
  private bibleId: string | null = null;

  constructor(private readonly cfg: ApiBibleConfig) {}

  async getChapter(book: string, ch: number): Promise<Verse[]> {
    const cached = readCachedChapter(this.cfg.db, 'NIV', book, ch);
    if (cached) return cached;

    const usfm = CANON.find((b) => b.id === book)?.usfm;
    if (!usfm) throw new Error(`Unknown book id: ${book}`);

    const bibleId = await this.resolveBibleId();
    const fetchFn = this.cfg.fetchFn ?? fetch;
    const url =
      `${API_BASE}/bibles/${bibleId}/chapters/${usfm}.${ch}` +
      `?content-type=json&include-notes=false&include-titles=false`;
    const res = await fetchFn(url, { headers: { 'api-key': this.cfg.apiKey } });
    if (!res.ok) throw new Error(`API.Bible ${res.status} for ${book} ${ch}`);

    const body = (await res.json()) as {
      data: { content: ApiContentItem[]; copyright?: string };
    };
    if (body.data.copyright) this.notice = body.data.copyright.trim();

    const verses = parseChapter(body.data.content, book, ch);
    if (verses.length === 0) throw new Error(`API.Bible returned no verses for ${book} ${ch}`);
    writeCachedChapter(this.cfg.db, 'NIV', book, ch, verses, this.cfg.now);
    return verses;
  }

  attribution(): string {
    return this.notice;
  }

  /** Resolved once per key, then cached in meta so later app opens skip the lookup. */
  private async resolveBibleId(): Promise<string> {
    if (this.bibleId) return this.bibleId;
    const cached = meta.get(this.cfg.db, 'niv_bible_id');
    if (cached) {
      this.bibleId = cached;
      return cached;
    }
    const resolved = await resolveNivBibleId(this.cfg.apiKey, this.cfg.fetchFn ?? fetch);
    meta.set(this.cfg.db, 'niv_bible_id', resolved);
    this.bibleId = resolved;
    return resolved;
  }
}

/**
 * The NIV bible id is a UUID that identifies the translation resource
 * itself on API.Bible, not something onboarding should ask the user
 * to hunt down — resolved here from the account's own /v1/bibles
 * listing instead of hardcoding a value nobody can verify offline.
 */
export async function resolveNivBibleId(apiKey: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const res = await fetchFn(`${API_BASE}/bibles`, { headers: { 'api-key': apiKey } });
  if (!res.ok) throw new Error(`API.Bible ${res.status} listing bibles`);
  const body = (await res.json()) as { data: Array<{ id: string; name: string; abbreviation?: string }> };
  const niv = body.data.find((b) => b.abbreviation === 'NIV' || /new international version/i.test(b.name));
  if (!niv) throw new Error('No NIV translation available for this API.Bible key');
  return niv.id;
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
