import type { SqlDb } from '../log/db';
import type { LadderResponse } from './ladder';

export interface PendingLapseResponse {
  date: string;
  response: LadderResponse;
}

/**
 * Today's ladder offer, if any and not yet responded to (§11) — same
 * discipline as report.ts's getPendingReport: surfaced once, never
 * re-asked once responded. The silent tiers ('none', 'reduce_dose')
 * never surface anything, and mechanic_friction's one_question is
 * excluded too — diagnose() (steps.ts) already resolves that
 * automatically (reverts the seal mode to tap without asking, per
 * §11) rather than posing it as a question with nothing to decide.
 */
export function getPendingLadderResponse(db: SqlDb, date: string): PendingLapseResponse | null {
  const row = db.get<{ ladder_action: string | null; ladder_payload: string | null; ladder_responded: number }>(
    'SELECT ladder_action, ladder_payload, ladder_responded FROM state WHERE local_date = ?',
    [date],
  );
  if (!row?.ladder_action || row.ladder_responded || !row.ladder_payload) return null;
  if (row.ladder_action === 'none' || row.ladder_action === 'reduce_dose') return null;

  const response = JSON.parse(row.ladder_payload) as LadderResponse;
  if (response.action === 'one_question' && response.route === 'mechanic_friction') return null;

  return { date, response };
}

export function markLadderResponded(db: SqlDb, date: string): void {
  db.run('UPDATE state SET ladder_responded = 1 WHERE local_date = ?', [date]);
}
