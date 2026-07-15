import { describe, expect, it } from 'vitest';
import { getPendingLadderResponse, markLadderResponded } from '../src/lab/lapse';
import { migrate } from '../src/log/schema';
import { openTestDb } from './util/testDb';

function seedState(
  db: ReturnType<typeof openTestDb>,
  date: string,
  action: string | null,
  payload: unknown,
  responded = 0,
) {
  db.run(
    `INSERT INTO state (local_date, ladder_action, ladder_payload, ladder_responded) VALUES (?, ?, ?, ?)`,
    [date, action, payload ? JSON.stringify(payload) : null, responded],
  );
}

describe('getPendingLadderResponse (§11 — surfaced once, same discipline as getPendingReport)', () => {
  it('null when there is no state row at all', () => {
    const db = openTestDb();
    migrate(db);
    expect(getPendingLadderResponse(db, '2026-07-14')).toBeNull();
  });

  it('null for the silent tiers — none and reduce_dose never surface anything', () => {
    const db = openTestDb();
    migrate(db);
    seedState(db, '2026-07-14', 'none', { action: 'none' });
    expect(getPendingLadderResponse(db, '2026-07-14')).toBeNull();

    seedState(db, '2026-07-15', 'reduce_dose', { action: 'reduce_dose', silent: true });
    expect(getPendingLadderResponse(db, '2026-07-15')).toBeNull();
  });

  it('null for mechanic_friction — resolved automatically, never asked as a question', () => {
    const db = openTestDb();
    migrate(db);
    seedState(db, '2026-07-14', 'one_question', { action: 'one_question', route: 'mechanic_friction' });
    expect(getPendingLadderResponse(db, '2026-07-14')).toBeNull();
  });

  it('surfaces a real one_question/offramp/dormant offer', () => {
    const db = openTestDb();
    migrate(db);
    seedState(db, '2026-07-14', 'one_question', { action: 'one_question', route: 'cue_collapse' });
    const pending = getPendingLadderResponse(db, '2026-07-14');
    expect(pending?.response).toEqual({ action: 'one_question', route: 'cue_collapse' });
  });

  it('never resurfaces once responded', () => {
    const db = openTestDb();
    migrate(db);
    seedState(db, '2026-07-14', 'offramp', { action: 'offramp', options: ['pause', 'keep_nudging'] }, 1);
    expect(getPendingLadderResponse(db, '2026-07-14')).toBeNull();
  });
});

describe('markLadderResponded', () => {
  it('flips the flag so it stops surfacing', () => {
    const db = openTestDb();
    migrate(db);
    seedState(db, '2026-07-14', 'dormant', { action: 'dormant', farewell: 'silent' });
    expect(getPendingLadderResponse(db, '2026-07-14')).not.toBeNull();

    markLadderResponded(db, '2026-07-14');

    expect(getPendingLadderResponse(db, '2026-07-14')).toBeNull();
  });
});
