/**
 * MODEL SPECIFICATION
 *
 * System:        real sequences a: ℕ → ℝ and real functions f: ℝ → ℝ, evaluated in IEEE double precision.
 * Dynamics:      none; these are numerical probes of limits, derivatives and roots.
 * Boundary:      every probe works on a finite window (n ≤ horizon, h ≥ hMin), so it gathers evidence and
 *                never proves a limit. A proof comes from the definition, never from this file.
 * Ignored:       exact arithmetic. Results carry rounding error of order 1e-15 relative, more under
 *                cancellation (a difference quotient with h below ~1e-8 is rounding noise).
 * Valid when:    the quantity is finite and the function is evaluated away from its singularities.
 * Failure modes: a sequence that converges only after the horizon looks divergent; an oscillating
 *                function (sin(1/x) near 0) defeats any finite sampling; catastrophic cancellation.
 *
 * Use it to recompute every number a lesson, a question or a figure shows (CLAUDE.md, "Recompute,
 * don't proof-read"), and to drive figures (the ε-strip of a sequence, the secant of a function).
 */

import { relativeError } from './vec';

export { relativeError };

export type Seq = (n: number) => number;
export type Fn = (x: number) => number;

/** a(n0), …, a(n1) as [n, a(n)] pairs. */
export function terms(a: Seq, n0: number, n1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let n = n0; n <= n1; n++) out.push([n, a(n)]);
  return out;
}

/**
 * The smallest N ≤ horizon such that |a(n) − L| < ε for every N ≤ n ≤ horizon. This is the N an ε-N
 * proof promises, found by search on a window: evidence for the figure and a check on a proof's formula
 * for N, not a proof. Returns null when the strip does not hold over at least the second half of the
 * window: (−1)ⁿ is inside the strip around 1 at n = horizon alone, and that is no evidence of anything.
 */
export function firstN(a: Seq, L: number, eps: number, horizon = 100_000, n0 = 1): number | null {
  let N: number | null = null;
  for (let n = horizon; n >= n0; n--) {
    if (Math.abs(a(n) - L) < eps) N = n;
    else break;
  }
  return N !== null && N <= horizon / 2 ? N : null;
}

/** True when every term from N to horizon lies in the open strip (L − ε, L + ε). */
export function inStripFrom(a: Seq, L: number, eps: number, N: number, horizon = 100_000): boolean {
  for (let n = N; n <= horizon; n++) if (!(Math.abs(a(n) - L) < eps)) return false;
  return true;
}

/** f(x0 ± h) for shrinking h: the values a one-sided limit is read from. side +1 = from the right. */
export function approach(f: Fn, x0: number, side: 1 | -1, steps = 8, h0 = 0.1): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0, h = h0; k < steps; k++, h /= 10) out.push([x0 + side * h, f(x0 + side * h)]);
  return out;
}

/** Central difference (f(x+h) − f(x−h)) / 2h: error O(h²) for a C³ function. */
export const centralDiff = (f: Fn, x: number, h = 1e-5): number => (f(x + h) - f(x - h)) / (2 * h);

/** One-sided difference quotient (f(x+h) − f(x)) / h, h may be negative: the definition's quotient. */
export const diffQuotient = (f: Fn, x: number, h: number): number => (f(x + h) - f(x)) / h;

/** Second derivative by the symmetric second difference: error O(h²) for a C⁴ function. */
export const secondDiff = (f: Fn, x: number, h = 1e-4): number => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);

/**
 * A root of a continuous f on [a, b] with f(a)·f(b) < 0, by bisection: the constructive proof of the
 * intermediate value theorem, run until the bracket is shorter than tol.
 */
export function bisect(f: Fn, a: number, b: number, tol = 1e-12, maxIter = 200): number {
  let fa = f(a);
  const fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) throw new Error(`bisect: f(${a}) and f(${b}) have the same sign`);
  for (let i = 0; i < maxIter && b - a > tol; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fm === 0) return m;
    if (fa * fm < 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/** max and min of f over a uniform grid of [a, b]: an estimate of sup/inf, exact only at grid points. */
export function gridExtrema(f: Fn, a: number, b: number, samples = 10_001): { min: number; xMin: number; max: number; xMax: number } {
  let min = Infinity, max = -Infinity, xMin = a, xMax = a;
  for (let i = 0; i < samples; i++) {
    const x = a + ((b - a) * i) / (samples - 1);
    const y = f(x);
    if (y < min) [min, xMin] = [y, x];
    if (y > max) [max, xMax] = [y, x];
  }
  return { min, xMin, max, xMax };
}

/** n! for small n, exact in double precision up to 22!. */
export function factorial(n: number): number {
  let p = 1;
  for (let k = 2; k <= n; k++) p *= k;
  return p;
}

/** C(n, k) by the multiplicative formula (exact for the sizes a course uses). */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) r = (r * (n - i + 1)) / i;
  return Math.round(r);
}

/** The Taylor polynomial Σ c_k (x − x0)^k for given coefficients c_k = f^(k)(x0)/k!. */
export const taylorEval = (coeffs: readonly number[], x0: number, x: number): number =>
  coeffs.reduceRight((acc, c) => acc * (x - x0) + c, 0);

/** Fractional agreement test with a readable message, for tests and recompute scripts. */
export function close(a: number, b: number, rel = 1e-9): boolean {
  return relativeError(a, b) <= rel || Math.abs(a - b) < 1e-300;
}
