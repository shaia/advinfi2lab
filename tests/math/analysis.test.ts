/**
 * The numerical probes in src/math/analysis.ts, filed by accuracy category. Each test is named after
 * the mathematical claim it checks.
 */

import { describe, expect, it } from 'vitest';
import {
  approach,
  binomial,
  bisect,
  centralDiff,
  diffQuotient,
  factorial,
  firstN,
  gridExtrema,
  inStripFrom,
  relativeError,
  secondDiff,
  taylorEval,
} from '~/math/analysis';

describe('analytic limits', () => {
  it('1/n enters the ε-strip around 0 exactly from N = ⌊1/ε⌋ + 1', () => {
    for (const eps of [0.1, 0.03, 0.007]) {
      expect(firstN((n) => 1 / n, 0, eps)).toBe(Math.floor(1 / eps) + 1);
    }
  });
  it('(1 + 1/n)^n approaches e from below and is within 1.4e-4 of it at n = 10⁴', () => {
    const a = (n: number) => (1 + 1 / n) ** n;
    expect(a(10_000)).toBeLessThan(Math.E);
    expect(Math.E - a(10_000)).toBeLessThan(1.4e-4);
  });
  it('sin(x)/x approaches 1 from both sides of 0', () => {
    const f = (x: number) => Math.sin(x) / x;
    for (const side of [1, -1] as const) {
      const last = approach(f, 0, side).at(-1)!;
      expect(relativeError(last[1], 1)).toBeLessThan(1e-12);
    }
  });
  it('(−1)ⁿ never stays in a strip of width 1 around any candidate limit', () => {
    for (const L of [-1, 0, 1]) expect(firstN((n) => (-1) ** n, L, 0.5, 1000)).toBeNull();
  });
});

describe('convergence', () => {
  it('the central difference of sin at 1 has error falling like h²', () => {
    const err = (h: number) => Math.abs(centralDiff(Math.sin, 1, h) - Math.cos(1));
    const ratio = err(1e-2) / err(1e-3);
    expect(ratio).toBeGreaterThan(90);
    expect(ratio).toBeLessThan(110);
  });
  it('the one-sided difference quotient of x² at 3 is exactly 6 + h', () => {
    for (const h of [0.5, -0.25, 0.125]) expect(diffQuotient((x) => x * x, 3, h)).toBeCloseTo(6 + h, 12);
  });
  it('the second difference of eˣ at 0 is 1 to 1e-6', () => {
    expect(Math.abs(secondDiff(Math.exp, 0) - 1)).toBeLessThan(1e-6);
  });
  it('bisection finds √2 as the root of x² − 2 on [1, 2] to 1e-12', () => {
    expect(Math.abs(bisect((x) => x * x - 2, 1, 2) - Math.SQRT2)).toBeLessThan(1e-12);
  });
  it('bisection refuses a bracket without a sign change', () => {
    expect(() => bisect((x) => x * x + 1, -1, 1)).toThrow();
  });
});

describe('exact identities', () => {
  it('the grid maximum of x(1 − x) on [0, 1] is 1/4 at x = 1/2', () => {
    const { max, xMax } = gridExtrema((x) => x * (1 - x), 0, 1);
    expect(max).toBeCloseTo(0.25, 12);
    expect(xMax).toBeCloseTo(0.5, 12);
  });
  it('Pascal: C(n, k) = C(n − 1, k − 1) + C(n − 1, k)', () => {
    for (let n = 2; n <= 20; n++) for (let k = 1; k < n; k++) expect(binomial(n, k)).toBe(binomial(n - 1, k - 1) + binomial(n - 1, k));
  });
  it('10! = 3628800', () => expect(factorial(10)).toBe(3_628_800));
  it('the degree-8 Taylor polynomial of eˣ at 0 is within the Lagrange bound e/9! at x = 1', () => {
    const coeffs = Array.from({ length: 9 }, (_, k) => 1 / factorial(k));
    expect(Math.E - taylorEval(coeffs, 0, 1)).toBeLessThan(Math.E / factorial(9));
    expect(Math.E - taylorEval(coeffs, 0, 1)).toBeGreaterThan(0);
  });
  it('a strip check over a window agrees with firstN', () => {
    const a = (n: number) => (n + 1) / n;
    const N = firstN(a, 1, 0.01)!;
    expect(inStripFrom(a, 1, 0.01, N)).toBe(true);
    expect(inStripFrom(a, 1, 0.01, N - 1)).toBe(false);
  });
});
