import { seededUniform } from './prng';

/**
 * Micro-randomized trial arm selection (§13, §10 — E5/E6). Weighted,
 * seeded, deterministic per (trialSeed, key) — the same decision
 * point always resolves to the same arm if replayed, which is what
 * makes the whole trial year reconstructible from one seed.
 */
export function weightedPick<A extends string>(trialSeed: string, key: string, weights: Record<A, number>): A {
  const entries = Object.entries(weights) as [A, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const r = seededUniform(trialSeed, key) * total;

  let acc = 0;
  for (const [arm, w] of entries) {
    acc += w;
    if (r < acc) return arm;
  }
  return entries[entries.length - 1][0]; // floating-point edge case at r ≈ total
}
