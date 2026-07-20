import { getRecentErrors } from '../errors';
import type { SqlDb } from '../log/db';
import { BUILD_SHA } from '../log/buildSha';
import { meta } from '../log/log';
import { schemaVersion } from '../log/schema';

/**
 * §20 "support with zero telemetry" — the whole point of this
 * function is that nothing about the app's state ever leaves the
 * phone unless the user explicitly copies and pastes it themselves.
 */
export function buildDiagnostics(db: SqlDb, now: () => number = Date.now): string {
  const lines: string[] = [
    `Thread diagnostics — ${new Date(now()).toISOString()}`,
    `build_sha: ${BUILD_SHA}`,
    `schema_version: ${schemaVersion(db)}`,
    `trial_start: ${meta.get(db, 'trial_start') ?? 'unset'}`,
    `watermark: ${meta.get(db, 'watermark') ?? 'unset'}`,
    `invariant_failed: ${meta.get(db, 'invariant_failed') ?? 'none'}`,
    `backup_last_export: ${meta.get(db, 'backup_last_export') ?? 'never'}`,
    '',
    'Recent errors:',
  ];

  const errors = getRecentErrors(db, 10);
  if (errors.length === 0) {
    lines.push('  (none)');
  } else {
    for (const e of errors) lines.push(`  ${new Date(e.ts).toISOString()} — ${e.message}`);
  }

  return lines.join('\n');
}
