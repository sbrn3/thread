// §13.6 hard rule: no Math.random() anywhere. Seeded PRNG only, so
// the whole trial year is reconstructible from trial_seed (§16.7).

/** xmur3 string hash → 32-bit seed. */
export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 — deterministic [0,1) stream from a 32-bit seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One deterministic coin flip per (seed, key) pair. */
export function seededBool(trialSeed: string, key: string): boolean {
  return mulberry32(hashSeed(`${trialSeed}:${key}`))() < 0.5;
}

/** Deterministic [0,1) draw for (seed, key) — MRT randomization. */
export function seededUniform(trialSeed: string, key: string): number {
  return mulberry32(hashSeed(`${trialSeed}:${key}`))();
}
