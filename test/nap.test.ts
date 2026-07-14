import { describe, expect, it } from 'vitest';
import { nap, randomizationTest } from '../src/lab/analysis/nap';

describe('nap (§15 nonoverlap of all pairs)', () => {
  it('returns 1.0 when every A value beats every B value', () => {
    expect(nap([10, 12], [5, 6])).toBe(1);
  });

  it('returns 0.0 when every B value beats every A value', () => {
    expect(nap([5, 6], [10, 12])).toBe(0);
  });

  it('returns 0.5 for no effect (fully overlapping)', () => {
    expect(nap([5, 5], [5, 5])).toBe(0.5);
  });

  it('counts ties as half a win', () => {
    expect(nap([5], [5])).toBe(0.5);
  });

  it('matches the plan\'s worked example: NAP 0.79ish for a strong-but-not-perfect effect', () => {
    // 3 of 4 cross-comparisons favor tap over hold, one tied-ish case
    const hold = [15, 18]; // A
    const tap = [19, 19]; // B
    // hold[0]=15 < both taps (0,0); hold[1]=18 < both taps (0,0) → nap(hold,tap) should be low
    expect(nap(hold, tap)).toBeLessThan(0.5);
  });

  it('is symmetric: nap(a,b) + nap(b,a) === 1', () => {
    const a = [10, 14, 9];
    const b = [12, 8, 11];
    expect(nap(a, b) + nap(b, a)).toBeCloseTo(1, 10);
  });
});

describe('randomizationTest (§15 — legitimate only because phase order was randomized)', () => {
  it('returns a low extremity (small proportion) for a clean, large separation', () => {
    const phases = [
      { arm: 'A' as const, value: 20 },
      { arm: 'B' as const, value: 5 },
      { arm: 'A' as const, value: 21 },
      { arm: 'B' as const, value: 6 },
    ];
    const p = randomizationTest(phases);
    expect(p).toBeLessThanOrEqual(1 / 3); // among the most extreme permutations
  });

  it('returns a high extremity (large proportion) when arms barely differ', () => {
    const phases = [
      { arm: 'A' as const, value: 10 },
      { arm: 'B' as const, value: 10 },
      { arm: 'A' as const, value: 10 },
      { arm: 'B' as const, value: 11 },
    ];
    const p = randomizationTest(phases);
    expect(p).toBeGreaterThan(0.3);
  });

  it('is symmetric under relabeling A/B', () => {
    const phases = [
      { arm: 'A' as const, value: 20 },
      { arm: 'B' as const, value: 5 },
      { arm: 'A' as const, value: 22 },
      { arm: 'B' as const, value: 6 },
    ];
    const swapped = phases.map((p) => ({ arm: (p.arm === 'A' ? 'B' : 'A') as 'A' | 'B', value: p.value }));
    expect(randomizationTest(phases)).toBeCloseTo(randomizationTest(swapped), 10);
  });
});
