import type { SqlDb } from '../log/db';
import { BUILD_SHA } from '../log/buildSha';

export interface ErrorLogEntry {
  ts: number;
  message: string;
  stack: string | null;
}

export function logError(db: SqlDb, message: string, stack?: string | null): void {
  db.run('INSERT INTO error_log (ts, message, stack, build_sha) VALUES (?, ?, ?, ?)', [
    Date.now(),
    message,
    stack ?? null,
    BUILD_SHA,
  ]);
}

export function getRecentErrors(db: SqlDb, limit = 20): ErrorLogEntry[] {
  // id DESC as a tiebreaker: several errors logged within the same
  // millisecond (a tight loop, or a crash cascading into more errors)
  // would otherwise have no defined order against a ts-only sort.
  return db.all<ErrorLogEntry>('SELECT ts, message, stack FROM error_log ORDER BY ts DESC, id DESC LIMIT ?', [limit]);
}

// A module-level ref, not a parameter, because the global JS-exception
// handler (below) is installed once at startup — before the db has
// necessarily opened — and has no other way to reach it.
let dbRef: SqlDb | null = null;

export function registerErrorDb(db: SqlDb): void {
  dbRef = db;
}

interface ErrorUtilsLike {
  setGlobalHandler: (fn: (error: Error, isFatal?: boolean) => void) => void;
  getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
}

/**
 * §19 error log — best-effort capture of JS exceptions outside React's
 * render tree (event handlers, async code), which ErrorBoundary can't
 * see. Chains to whatever handler React Native already installed
 * (its own redbox/dev handler) rather than replacing it.
 */
export function installGlobalErrorHandler(): void {
  const g = globalThis as unknown as { ErrorUtils?: ErrorUtilsLike };
  if (!g.ErrorUtils) return;

  const previous = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (dbRef) {
      try {
        logError(dbRef, error.message, error.stack ?? null);
      } catch {
        // Logging the crash must never itself crash the crash handler.
      }
    }
    previous?.(error, isFatal);
  });
}
