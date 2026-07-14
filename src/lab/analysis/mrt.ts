import type { SqlDb } from '../../log/db';

export interface ArmRate {
  arm: string;
  n: number;
  rewardRate: number;
}

export interface Moderation {
  moderator: 'day_of_week' | 'month';
  buckets: Array<{ bucket: string; rates: ArmRate[] }>;
}

export interface MrtReport {
  point: string;
  overall: ArmRate[];
  moderation: Moderation[];
  /** §15: main effects are detectable; moderation is exploratory — this can never be 'strong'. */
  confidence: 'weak' | 'inconclusive';
}

interface DecisionRow {
  local_date: string;
  arm: string;
  reward: number;
}

function rowsFor(db: SqlDb, point: string): DecisionRow[] {
  // Only delivered, rewarded rows count — a voided (delivered=0) row
  // was never a real comparison point (§13.4), and an unrewarded-yet
  // null row hasn't been attributed yet by reconcile().
  return db.all<DecisionRow>(
    `SELECT local_date, arm, reward FROM decisions WHERE point = ? AND delivered = 1 AND reward IS NOT NULL`,
    [point],
  );
}

function rates(rows: DecisionRow[]): ArmRate[] {
  const byArm = new Map<string, number[]>();
  for (const r of rows) {
    if (!byArm.has(r.arm)) byArm.set(r.arm, []);
    byArm.get(r.arm)!.push(r.reward);
  }
  return Array.from(byArm.entries()).map(([arm, rewards]) => ({
    arm,
    n: rewards.length,
    rewardRate: rewards.reduce((s, x) => s + x, 0) / rewards.length,
  }));
}

function dayOfWeek(date: string): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return names[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

/**
 * §15 MRT analysis — proximal effect across all decision points, plus
 * pre-declared moderators only (day of week, month). No fishing:
 * these are the only two splits computed. Moderator findings are
 * exploratory by construction — the confidence scale never returns
 * 'strong' here, matching §15's explicit rule.
 */
export function analyzeMrt(db: SqlDb, point: string): MrtReport | null {
  const rows = rowsFor(db, point);
  if (rows.length === 0) return null;

  const overall = rates(rows);

  const byDow = new Map<string, DecisionRow[]>();
  const byMonth = new Map<string, DecisionRow[]>();
  for (const r of rows) {
    const dow = dayOfWeek(r.local_date);
    const month = r.local_date.slice(0, 7); // YYYY-MM
    if (!byDow.has(dow)) byDow.set(dow, []);
    byDow.get(dow)!.push(r);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(r);
  }

  const moderation: Moderation[] = [
    {
      moderator: 'day_of_week',
      buckets: Array.from(byDow.entries()).map(([bucket, bucketRows]) => ({ bucket, rates: rates(bucketRows) })),
    },
    {
      moderator: 'month',
      buckets: Array.from(byMonth.entries()).map(([bucket, bucketRows]) => ({ bucket, rates: rates(bucketRows) })),
    },
  ];

  // A meaningful overall spread between arms is "weak" at best (never
  // strong — §15); anything muddier is inconclusive.
  const spread = overall.length >= 2 ? Math.max(...overall.map((a) => a.rewardRate)) - Math.min(...overall.map((a) => a.rewardRate)) : 0;
  const confidence: MrtReport['confidence'] = spread >= 0.1 && rows.length >= 30 ? 'weak' : 'inconclusive';

  return { point, overall, moderation, confidence };
}
