import type { SqlDb } from '../log/db';
import { ApiBibleProvider } from './apiBible';
import { EsvProvider } from './esv';
import { BundledProvider, ChainedProvider, type BundledBible, type TextProvider } from './provider';

// Metro bundles the JSON into the app binary — offline, always available.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WEB: BundledBible = require('../../assets/bible/web.json');

export interface TextConfig {
  db: SqlDb;
  /** Chosen at onboarding (§05), read from meta at runtime — never baked into the build. */
  provider: 'niv' | 'esv' | null;
  apiKey: string | null;
}

/**
 * Chapter counts follow the bundled WEB versification regardless of
 * which provider is actually serving text — the only canon-complete
 * offline data we have. NIV/ESV chapter/verse boundaries match closely
 * enough for navigation purposes (book_finish, next-chapter advance).
 */
export function bundledChapterCount(book: string): number {
  return WEB.books[book]?.length ?? 0;
}

/**
 * Licensed provider (NIV or ESV, whichever was chosen at onboarding)
 * when a key is present; bundled WEB as the offline floor always.
 * §05: "Skip for now" at onboarding leaves provider/apiKey null and
 * the app reads WEB until a key is added later from the knot.
 */
export function createTextProvider(cfg: TextConfig): TextProvider {
  const bundled = new BundledProvider(WEB);
  if (!cfg.provider || !cfg.apiKey) return bundled;

  const primary =
    cfg.provider === 'niv'
      ? new ApiBibleProvider({ apiKey: cfg.apiKey, db: cfg.db })
      : new EsvProvider({ apiKey: cfg.apiKey, db: cfg.db });

  return new ChainedProvider([primary, bundled]);
}

export { BundledProvider, ChainedProvider } from './provider';
export type { BundledBible, TextProvider, Verse } from './provider';
