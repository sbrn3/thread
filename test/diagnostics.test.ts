import { describe, expect, it } from 'vitest';
import { logError } from '../src/errors';
import { buildDiagnostics } from '../src/lab/diagnostics';
import { meta } from '../src/log/log';
import { migrate } from '../src/log/schema';
import { openTestDb } from './util/testDb';

describe('buildDiagnostics (§20 — support with zero telemetry)', () => {
  it('includes build_sha, schema_version, and key meta values', () => {
    const db = openTestDb();
    migrate(db);
    meta.set(db, 'trial_start', '2026-01-01');
    meta.set(db, 'watermark', '2026-07-14');

    const text = buildDiagnostics(db, () => Date.UTC(2026, 6, 14));

    expect(text).toContain('build_sha:');
    expect(text).toContain('schema_version:');
    expect(text).toContain('trial_start: 2026-01-01');
    expect(text).toContain('watermark: 2026-07-14');
  });

  it('reports "unset"/"none"/"never" for absent values rather than blank or throwing', () => {
    const db = openTestDb();
    migrate(db);
    const text = buildDiagnostics(db);
    expect(text).toContain('trial_start: unset');
    expect(text).toContain('invariant_failed: none');
    expect(text).toContain('backup_last_export: never');
  });

  it('lists recent errors, or says none', () => {
    const db = openTestDb();
    migrate(db);
    expect(buildDiagnostics(db)).toContain('(none)');

    logError(db, 'something broke');
    expect(buildDiagnostics(db)).toContain('something broke');
  });
});
