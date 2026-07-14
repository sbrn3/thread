import { describe, expect, it } from 'vitest';
import { migrate } from '../src/log/schema';
import { analyzeMrt } from '../src/lab/analysis/mrt';
import { openTestDb } from './util/testDb';

function seedDecision(
  db: ReturnType<typeof openTestDb>,
  date: string,
  arm: string,
  reward: number,
  point = 'nudge_hour',
) {
  db.run(
    `INSERT INTO decisions (local_date, point, arm, delivered, reward) VALUES (?, ?, ?, 1, ?)`,
    [date, point, arm, reward],
  );
}

describe('analyzeMrt (§15 MRT analysis)', () => {
  it('returns null with no delivered, rewarded decisions yet', () => {
    const db = openTestDb();
    migrate(db);
    expect(analyzeMrt(db, 'nudge_hour')).toBeNull();
  });

  it('ignores voided (delivered=0) and not-yet-attributed (reward IS NULL) rows', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO decisions (local_date, point, arm, delivered, reward) VALUES ('2026-07-01','nudge_hour','silence',0,1)`);
    db.run(`INSERT INTO decisions (local_date, point, arm, delivered, reward) VALUES ('2026-07-02','nudge_hour','silence',1,NULL)`);

    expect(analyzeMrt(db, 'nudge_hour')).toBeNull();
  });

  it('computes reward rate per arm across all delivered decision points', () => {
    const db = openTestDb();
    migrate(db);
    seedDecision(db, '2026-07-01', 'anchor_echo', 1);
    seedDecision(db, '2026-07-02', 'anchor_echo', 0);
    seedDecision(db, '2026-07-03', 'silence', 1);
    seedDecision(db, '2026-07-04', 'silence', 1);

    const report = analyzeMrt(db, 'nudge_hour')!;
    const anchorEcho = report.overall.find((a) => a.arm === 'anchor_echo')!;
    const silence = report.overall.find((a) => a.arm === 'silence')!;
    expect(anchorEcho).toEqual({ arm: 'anchor_echo', n: 2, rewardRate: 0.5 });
    expect(silence).toEqual({ arm: 'silence', n: 2, rewardRate: 1 });
  });

  it('splits by day-of-week and month as pre-declared moderators, and nothing else', () => {
    const db = openTestDb();
    migrate(db);
    seedDecision(db, '2026-07-01', 'anchor_echo', 1); // Wednesday
    seedDecision(db, '2026-07-08', 'anchor_echo', 0); // Wednesday

    const report = analyzeMrt(db, 'nudge_hour')!;
    const moderatorNames = report.moderation.map((m) => m.moderator);
    expect(moderatorNames).toEqual(['day_of_week', 'month']);

    const dow = report.moderation.find((m) => m.moderator === 'day_of_week')!;
    expect(dow.buckets).toHaveLength(1); // both decisions fall on the same weekday
    expect(dow.buckets[0].bucket).toBe('Wed');
  });

  it('never reports strong confidence — MRT moderation is exploratory by construction (§15)', () => {
    const db = openTestDb();
    migrate(db);
    const day = (month: string, i: number) => `2026-${month}-${String((i % 28) + 1).padStart(2, '0')}`;
    // A huge, obvious spread — still capped at 'weak', never 'strong'.
    for (let i = 0; i < 20; i++) seedDecision(db, day('07', i), 'anchor_echo', 1);
    for (let i = 0; i < 20; i++) seedDecision(db, day('08', i), 'silence', 0);

    const report = analyzeMrt(db, 'nudge_hour')!;
    expect(report.confidence).not.toBe('strong' as unknown);
    expect(['weak', 'inconclusive']).toContain(report.confidence);
  });
});
