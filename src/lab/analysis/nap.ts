/**
 * NAP — nonoverlap of all pairs (§15). Robust with small counts, no
 * distributional assumptions; the standard single-case-design effect
 * size. 1.0 = every A-phase value beat every B-phase value; 0.5 = no
 * effect; 0.0 = every B beat every A.
 */
export function nap(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0.5;
  let wins = 0;
  for (const x of a) {
    for (const y of b) {
      wins += x > y ? 1 : x === y ? 0.5 : 0;
    }
  }
  return wins / (a.length * b.length);
}

/**
 * Randomization test (§15) — legitimate ONLY because phase order was
 * randomized (§13). Permutes which phases "count" as A vs B and asks
 * how extreme the observed mean difference is against that null
 * distribution. This is the n=1 alternative to a t-test. With 4
 * phases the permutation space is small enough to enumerate exactly.
 *
 * Returns the proportion of permutations at least as extreme as what
 * was actually observed — i.e. "the observed gap exceeds X% of label
 * permutations" is `1 - result`.
 */
export function randomizationTest(phases: Array<{ arm: 'A' | 'B'; value: number }>): number {
  const values = phases.map((p) => p.value);
  const observed = Math.abs(meanDiff(phases));

  const arms: Array<'A' | 'B'> = phases.map((p) => p.arm);
  const permutations = allLabelPermutations(arms);

  let atLeastAsExtreme = 0;
  for (const perm of permutations) {
    const relabeled = values.map((value, i) => ({ arm: perm[i], value }));
    if (Math.abs(meanDiff(relabeled)) >= observed) atLeastAsExtreme++;
  }
  return atLeastAsExtreme / permutations.length;
}

function meanDiff(phases: Array<{ arm: 'A' | 'B'; value: number }>): number {
  const a = phases.filter((p) => p.arm === 'A').map((p) => p.value);
  const b = phases.filter((p) => p.arm === 'B').map((p) => p.value);
  if (a.length === 0 || b.length === 0) return 0;
  return mean(a) - mean(b);
}

function mean(xs: number[]): number {
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

/** All distinct orderings of the given arm labels — small (≤4 items ⇒ ≤24 perms), enumerated exactly. */
function allLabelPermutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const perm of allLabelPermutations(rest)) {
      out.push([items[i], ...perm]);
    }
  }
  return out;
}
