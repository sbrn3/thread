import type { SqlDb } from '../log/db';
import { ApiBibleProvider } from './apiBible';
import { BundledProvider, ChainedProvider, type BundledBible, type TextProvider } from './provider';

// Metro bundles the JSON into the app binary — offline, always available.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WEB: BundledBible = require('../../assets/bible/web.json');

export interface TextConfig {
  db: SqlDb;
  /** From api.scripture.api.bible — absent means WEB only. */
  apiBibleKey?: string;
  /** The NIV bible id listed for your key. */
  apiBibleId?: string;
}

/** NIV when licensed + reachable/cached; bundled WEB as the offline floor. */
export function createTextProvider(cfg: TextConfig): TextProvider {
  const bundled = new BundledProvider(WEB);
  if (cfg.apiBibleKey && cfg.apiBibleId) {
    const niv = new ApiBibleProvider({
      apiKey: cfg.apiBibleKey,
      bibleId: cfg.apiBibleId,
      db: cfg.db,
    });
    return new ChainedProvider([niv, bundled]);
  }
  return bundled;
}

export { BundledProvider, ChainedProvider } from './provider';
export type { BundledBible, TextProvider, Verse } from './provider';
