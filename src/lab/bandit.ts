import type { SqlDb } from '../log/db';
import { meta } from '../log/log';
import { addDays, datesBetween } from '../log/time';
import { getProfile } from './profile';
import { hashSeed, mulberry32 } from './prng';

// §18 — the adaptive layer. Ships dormant: built now, activates only
// at day 366. Governs MOMENTS only (which nudge arm) — never
// structure (frequency/seal/floor/streak, decided by the reversals).
// There is no code path from this module to anything structural.

export const BANDIT_ARMS = ['anchor_echo', 'neutral', 'silence'] as const;
export type BanditArm = (typeof BANDIT_ARMS)[number];

export type BanditBucket = 'steady_recent' | 'steady_rested' | 'lapsing_recent' | 'lapsing_rested';

const ACTIVATION_DAY = 366;
const MIN_EVIDENCE = 20; // 4 buckets × 20 ≈ 80 decisions ≈ 3 months, per the plan's own arithmetic
const DECAY = 0.995; // ~140-day half-life — track the present you, not the whole year
const CHANGE_POINT_THRESHOLD = 0.3;
const EXPLORATION_MIN = 0.05;
const EXPLORATION_MAX = 0.15;

/** Frozen with profile.adaptive_frozen — the plan's "one-tap freeze, always." */
export function isAdaptiveActive(db: SqlDb, date: string): boolean {
  if (getProfile(db, 'adaptive_frozen') === '1') return false;
  const trialStart = meta.get(db, 'trial_start');
  if (!trialStart) return false;
  return datesBetween(trialStart, date).length >= ACTIVATION_DAY;
}

/**
 * FOUR buckets, deliberately — a larger context space would need
 * thousands of observations and never activate at ~1 decision/day.
 * Habituation is modelled directly: nudgeRecency is part of the
 * bucket because using a nudge degrades it and resting it restores
 * it — day-of-week/season/book-position are left as pooled features
 * for a future model, not a partition, since partitioning is what
 * you do with millions of users.
 */
export function computeBucket(daysSinceRead: number, nudgeRecencyDays: number): BanditBucket {
  const steadiness = daysSinceRead === 0 ? 'steady' : 'lapsing';
  const recency = nudgeRecencyDays <= 1 ? 'recent' : 'rested';
  return `${steadiness}_${recency}` as BanditBucket;
}

/**
 * daysSinceRead: gap since the last sealed day, as of `date` — the
 * same convention as ladder_day (steps.ts). nudgeRecencyDays: gap
 * since the last non-silence nudge_hour decision — a proxy for
 * "was a real notification recently sent," since delivery itself
 * isn't confirmable without a live listener (see attributeRewards).
 */
export function computeContext(db: SqlDb, date: string): { daysSinceRead: number; nudgeRecencyDays: number } {
  const lastSealed = db.get<{ local_date: string }>(
    `SELECT local_date FROM days WHERE sealed = 1 AND local_date < ? ORDER BY local_date DESC LIMIT 1`,
    [date],
  );
  const daysSinceRead = lastSealed ? datesBetween(lastSealed.local_date, date).length : 9999;

  const lastNudge = db.get<{ local_date: string }>(
    `SELECT local_date FROM decisions WHERE point = 'nudge_hour' AND arm != 'silence' AND local_date < ?
       ORDER BY local_date DESC LIMIT 1`,
    [date],
  );
  const nudgeRecencyDays = lastNudge ? datesBetween(lastNudge.local_date, date).length : 9999;

  return { daysSinceRead, nudgeRecencyDays };
}

interface Posterior {
  alpha: number;
  beta: number;
  nObs: number;
  lastCp: string | null;
}

const UNIFORM_PRIOR: Posterior = { alpha: 1, beta: 1, nObs: 0, lastCp: null };

function getPosterior(db: SqlDb, arm: string, bucket: string): Posterior {
  const row = db.get<{ alpha: number; beta: number; n_obs: number; last_cp: string | null }>(
    'SELECT alpha, beta, n_obs, last_cp FROM bandit WHERE arm = ? AND bucket = ?',
    [arm, bucket],
  );
  return row ? { alpha: row.alpha, beta: row.beta, nObs: row.n_obs, lastCp: row.last_cp } : { ...UNIFORM_PRIOR };
}

function setPosterior(db: SqlDb, arm: string, bucket: string, p: Posterior): void {
  db.run(
    `INSERT INTO bandit (arm, bucket, alpha, beta, n_obs, last_cp) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(arm, bucket) DO UPDATE SET
       alpha = excluded.alpha, beta = excluded.beta, n_obs = excluded.n_obs, last_cp = excluded.last_cp`,
    [arm, bucket, p.alpha, p.beta, p.nObs, p.lastCp],
  );
}

function bucketTotalObs(db: SqlDb, bucket: string): number {
  const row = db.get<{ total: number | null }>('SELECT SUM(n_obs) as total FROM bandit WHERE bucket = ?', [bucket]);
  return row?.total ?? 0;
}

// ---- seeded Beta sampling (§16.7 — no Math.random anywhere) ----
// Standard Marsaglia-Tsang Gamma sampling (shape >= 1, boosted below
// 1) feeding a Box-Muller normal, both driven by the seeded uniform
// stream — Beta(a,b) = X/(X+Y) for X~Gamma(a), Y~Gamma(b).

function sampleNormal(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12); // guard log(0)
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function sampleGamma(rng: () => number, shape: number): number {
  if (shape < 1) {
    const boosted = sampleGamma(rng, shape + 1);
    return boosted * Math.pow(Math.max(rng(), 1e-12), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let attempt = 0; attempt < 100; attempt++) {
    let x: number;
    let v: number;
    do {
      x = sampleNormal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  return d; // practically unreachable — the loop above converges within a handful of attempts
}

export function sampleBeta(rng: () => number, alpha: number, beta: number): number {
  const x = sampleGamma(rng, alpha);
  const y = sampleGamma(rng, beta);
  return x / (x + y);
}

/** More exploration while a bucket is young, settling toward the floor — clamped either way, never fully stops learning. */
function explorationRate(nObs: number): number {
  const raw = 0.3 - nObs * 0.002;
  return Math.min(EXPLORATION_MAX, Math.max(EXPLORATION_MIN, raw));
}

/**
 * §18 choose() — below MIN_EVIDENCE for this bucket, falls back to
 * `fallbackArm` (the year-one profile's answer) rather than sampling
 * from an uninformative prior. Deterministic per (trialSeed, date):
 * replaying the same seed reproduces the same choice.
 */
export function chooseArm(
  db: SqlDb,
  trialSeed: string,
  date: string,
  bucket: BanditBucket,
  fallbackArm: BanditArm,
): BanditArm {
  const nObs = bucketTotalObs(db, bucket);
  if (nObs < MIN_EVIDENCE) return fallbackArm;

  const rng = mulberry32(hashSeed(`${trialSeed}:bandit:${date}`));
  const scored = BANDIT_ARMS.map((arm) => {
    const p = getPosterior(db, arm, bucket);
    return { arm, sample: sampleBeta(rng, p.alpha, p.beta) };
  });
  const best = scored.reduce((a, b) => (b.sample > a.sample ? b : a)).arm;

  if (rng() < explorationRate(nObs)) {
    const others = BANDIT_ARMS.filter((a) => a !== best);
    return others[Math.floor(rng() * others.length)];
  }
  return best;
}

/**
 * §18 "Change-point: |recent(14d) − longRun| > 0.30 → reset." Needs a
 * minimum of both windows' worth of data to call a change confidently
 * — otherwise a quiet bucket could "change-point" on pure noise.
 */
function detectChangePoint(db: SqlDb, arm: string, bucket: string, date: string): boolean {
  const recentStart = addDays(date, -14);
  const recent = db.get<{ n: number; rewarded: number | null }>(
    `SELECT COUNT(*) as n, SUM(reward) as rewarded FROM decisions
       WHERE point = 'nudge_hour' AND arm = ? AND bucket = ? AND reward IS NOT NULL
         AND local_date >= ? AND local_date <= ?`,
    [arm, bucket, recentStart, date],
  );
  const longRun = db.get<{ n: number; rewarded: number | null }>(
    `SELECT COUNT(*) as n, SUM(reward) as rewarded FROM decisions
       WHERE point = 'nudge_hour' AND arm = ? AND bucket = ? AND reward IS NOT NULL AND local_date <= ?`,
    [arm, bucket, date],
  );
  if (!recent || !longRun || recent.n < 5 || longRun.n < MIN_EVIDENCE) return false;

  const recentRate = (recent.rewarded ?? 0) / recent.n;
  const longRunRate = (longRun.rewarded ?? 0) / longRun.n;
  return Math.abs(recentRate - longRunRate) > CHANGE_POINT_THRESHOLD;
}

/**
 * §18 update() — decay toward the uniform prior (a ~140-day half-
 * life: old evidence fades rather than accumulating forever), bump
 * the rewarded/unrewarded count, then reset entirely on a detected
 * change-point ("your life changed; don't spend months averaging
 * over a person you no longer are").
 */
export function updateBanditPosterior(db: SqlDb, arm: string, bucket: BanditBucket, reward: boolean, date: string): void {
  if (detectChangePoint(db, arm, bucket, date)) {
    setPosterior(db, arm, bucket, { ...UNIFORM_PRIOR, lastCp: date });
    return;
  }

  const current = getPosterior(db, arm, bucket);
  const decayedAlpha = 1 + (current.alpha - 1) * DECAY;
  const decayedBeta = 1 + (current.beta - 1) * DECAY;
  setPosterior(db, arm, bucket, {
    alpha: reward ? decayedAlpha + 1 : decayedAlpha,
    beta: reward ? decayedBeta : decayedBeta + 1,
    nObs: current.nObs + 1,
    lastCp: current.lastCp,
  });
}

/**
 * §18 guardrails, outside the policy, and able to veto it — checked
 * against TODAY's diagnosed state (signature/dormancy for a specific
 * future date isn't known yet; syncWindow already treats "whatever's
 * true today" as the planning basis for its whole rolling window, the
 * same simplification as its cue-snapshot behaviour).
 */
export function guardrailsSilence(db: SqlDb, today: string): boolean {
  const state = db.get<{ dormant: number; signature: string }>(
    'SELECT dormant, signature FROM state WHERE local_date = ?',
    [today],
  );
  if (!state) return false;
  return state.dormant === 1 || state.signature === 'life_disruption';
}

/** §18 "the knot always shows the current policy in plain language." */
export function describePolicy(db: SqlDb, bucket: BanditBucket): string {
  const nObs = bucketTotalObs(db, bucket);
  if (nObs < MIN_EVIDENCE) {
    return `Still learning (${nObs}/${MIN_EVIDENCE} observations) — using the year-one default for now.`;
  }
  const scored = BANDIT_ARMS.map((arm) => {
    const p = getPosterior(db, arm, bucket);
    return { arm, rate: p.alpha / (p.alpha + p.beta) };
  });
  const leader = scored.reduce((a, b) => (b.rate > a.rate ? b : a));
  return `Currently favouring "${leader.arm}" for ${bucket.replace('_', ', ')} days (~${Math.round(
    explorationRate(nObs) * 100,
  )}% exploration).`;
}
