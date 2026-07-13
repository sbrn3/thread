// §07 — the text layer is a provider with a single method. Ship with
// the public-domain text bundled (Path B) so the app ALWAYS works;
// add the API.Bible provider for NIV when a key is in hand (Path A).

export interface Verse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  /** True when this verse opens a paragraph — sittings never split mid-thought. */
  paragraphStart?: boolean;
}

export interface TextProvider {
  getChapter(book: string, ch: number): Promise<Verse[]>;
  /** Rendered under every chapter if non-null. For NIV this notice is a licence condition, not a nicety. */
  attribution(): string | null;
}

export interface BundledBible {
  translation: string;
  attribution: string | null;
  books: Record<string, { chapters: Verse[][] }>;
}

/** BundledProvider → /assets/bible/web.json (offline, always available). */
export class BundledProvider implements TextProvider {
  constructor(private readonly data: BundledBible) {}

  async getChapter(book: string, ch: number): Promise<Verse[]> {
    const b = this.data.books[book];
    const verses = b?.chapters[ch - 1];
    if (!verses) throw new Error(`No such chapter: ${book} ${ch}`);
    return verses;
  }

  attribution(): string | null {
    return this.data.attribution;
  }
}

// ApiBibleProvider → api.bible, NIV, cache-on-read (network required).
// Caching the fetched chapter locally for re-reading is fine;
// bulk-downloading the translation is not (§07). Added when an
// API.Bible key is in hand — see README "What's still needed".
