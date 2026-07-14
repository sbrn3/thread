import { CueService } from '../cue';
import { BUILD_SHA } from '../log/buildSha';
import type { SqlDb } from '../log/db';
import { openAppDb } from '../log/expoDb';
import { Log } from '../log/log';
import { migrate } from '../log/schema';
import { Memory } from '../memory/memory';
import { createTextProvider, type TextProvider } from '../text';

export interface Services {
  db: SqlDb;
  log: Log;
  text: TextProvider;
  cue: CueService;
  memory: Memory;
}

/**
 * One set of app-lifetime instances. Created once in App.tsx via
 * useMemo and threaded down through props/context — these hold a
 * live SQLite connection, so they are not recreated per render.
 */
export function createServices(): Services {
  const db = openAppDb();
  migrate(db);
  const log = new Log({ db, buildSha: BUILD_SHA });
  const text = createTextProvider({
    db,
    apiBibleKey: process.env.EXPO_PUBLIC_APIBIBLE_KEY,
    apiBibleId: process.env.EXPO_PUBLIC_APIBIBLE_ID,
  });
  const cue = new CueService(db, log);
  const memory = new Memory(db, log);
  return { db, log, text, cue, memory };
}
