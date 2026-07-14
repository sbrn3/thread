import { describe, expect, it } from 'vitest';
import { weightedPick } from '../src/lab/mrt';

describe('weightedPick (§13/§10 MRT arm selection)', () => {
  it('is deterministic per (trialSeed, key) — same inputs, same arm, every time', () => {
    const weights = { a: 0.4, b: 0.4, c: 0.2 };
    const first = weightedPick('seed', 'E5:2026-07-14', weights);
    const second = weightedPick('seed', 'E5:2026-07-14', weights);
    expect(first).toBe(second);
  });

  it('different keys under the same seed can yield different arms', () => {
    const weights = { a: 0.5, b: 0.5 };
    const picks = new Set(
      Array.from({ length: 20 }, (_, i) => weightedPick('seed', `key-${i}`, weights)),
    );
    expect(picks.size).toBeGreaterThan(1); // not the same arm every single time
  });

  it('approximates the declared weights over many draws', () => {
    const weights = { a: 0.8, b: 0.2 };
    const counts = { a: 0, b: 0 };
    const n = 2000;
    for (let i = 0; i < n; i++) {
      counts[weightedPick('seed', `k${i}`, weights) as 'a' | 'b']++;
    }
    expect(counts.a / n).toBeGreaterThan(0.7);
    expect(counts.a / n).toBeLessThan(0.9);
  });

  it('a single 100%-weight arm always wins', () => {
    expect(weightedPick('seed', 'x', { only: 1 })).toBe('only');
  });
});
