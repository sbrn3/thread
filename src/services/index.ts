import * as ExpoNotifications from 'expo-notifications';
import { CueService } from '../cue';
import { BUILD_SHA } from '../log/buildSha';
import type { SqlDb } from '../log/db';
import { openAppDb } from '../log/expoDb';
import { Log, meta } from '../log/log';
import { migrate } from '../log/schema';
import { Memory } from '../memory/memory';
import { Notifier } from '../notify';
import { createTextProvider, type TextProvider } from '../text';

export interface Services {
  db: SqlDb;
  log: Log;
  text: TextProvider;
  cue: CueService;
  memory: Memory;
  notifier: Notifier;
}

/** Opens the one SQLite connection the app uses for its whole lifetime, migrated to latest. */
export function openDb(): SqlDb {
  const db = openAppDb();
  migrate(db);
  return db;
}

/**
 * The rest of the app-lifetime instances, built from an already-open
 * db. Split from openDb() because the text provider depends on
 * meta['text_provider']/['text_provider_key'] — written by onboarding
 * — so this can't run until onboarding has had a chance to set them
 * (App.tsx calls this only once onboarding is confirmed complete).
 */
export function createServices(db: SqlDb): Services {
  const log = new Log({ db, buildSha: BUILD_SHA });
  const text = createTextProvider({
    db,
    provider: meta.get(db, 'text_provider') as 'niv' | 'esv' | null,
    apiKey: meta.get(db, 'text_provider_key'),
  });
  const cue = new CueService(db, log);
  const memory = new Memory(db, log);
  const notifier = new Notifier(db, ExpoNotifications);
  return { db, log, text, cue, memory, notifier };
}
