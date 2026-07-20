import type { SqlDb } from '../../log/db';

export interface AmendmentEntry {
  ts: number;
  kind: 'applied' | 'kept' | 'build';
  text: string;
}

/**
 * §19 "the amendment log is the changelog" — what the app learned
 * (an experiment's recommendation, Applied or Kept) and when its own
 * code changed (build_changed, marking deploy boundaries) is the
 * project's actual history, merged into one chronological log.
 */
export function getAmendmentLog(db: SqlDb): AmendmentEntry[] {
  const reportRows = db.all<{ exp_id: string; generated_at: number; applied: number; recommendation: string }>(
    `SELECT exp_id, generated_at, applied, recommendation FROM reports WHERE applied IS NOT NULL ORDER BY generated_at`,
  );
  const buildRows = db.all<{ ts: number; build_sha: string }>(
    `SELECT ts, build_sha FROM events WHERE type = 'build_changed' ORDER BY ts`,
  );

  const entries: AmendmentEntry[] = [
    ...reportRows.map(
      (r): AmendmentEntry => ({
        ts: r.generated_at,
        kind: r.applied ? 'applied' : 'kept',
        text: `${r.exp_id}: ${r.applied ? 'Applied' : 'Kept'} — ${r.recommendation}`,
      }),
    ),
    ...buildRows.map(
      (b): AmendmentEntry => ({
        ts: b.ts,
        kind: 'build',
        text: `Build changed to ${b.build_sha}`,
      }),
    ),
  ];

  return entries.sort((a, b) => a.ts - b.ts);
}
