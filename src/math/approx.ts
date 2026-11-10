/**
 * Approximation in inner product spaces as numerical probes: the L² inner product on [a, b], Gram–Schmidt on
 * monomials (Legendre polynomials on [−1, 1]), the orthogonal projection onto polynomials of degree ≤ n and its
 * distance, and Bessel / Parseval sums for Fourier coefficients (period [−π, π], coefficients with 1/π, as in
 * fourierCoeffs of multivar.ts).
 *
 * MODEL SPECIFICATION
 * - System: real functions on [a, b] with ⟨f, g⟩ = ∫_a^b f g; polynomials as coefficient arrays c[0] + c[1]x + …
 * - Dynamics: none; Gram–Schmidt runs exactly on polynomial coefficients (inner products of monomials are
 *   computed in closed form), and ⟨f, p⟩ for a general f by composite Simpson.
 * - Ignored: the ill-conditioning of monomials beyond degree ~12 (the course never needs it).
 * - Valid when: f is continuous on [a, b], or the jump points are passed to Simpson as panel ends.
 * - Failure modes: high degrees lose orthogonality to rounding; a jump inside a Simpson panel costs accuracy.
 *
 * A probe is evidence, never proof: course claims come from the proof, and these numbers recompute keys.
 */

import { simpson } from './multivar';

export type Poly = number[];

export const polyEval = (c: Poly, x: number): number => c.reduceRight((s, a) => s * x + a, 0);

/** ⟨f, g⟩ = ∫_a^b f g by Simpson. */
export const innerL2 = (f: (x: number) => number, g: (x: number) => number, a: number, b: number, n = 4000): number =>
  simpson((x) => f(x) * g(x), a, b, n);

export const normL2 = (f: (x: number) => number, a: number, b: number, n = 4000): number => Math.sqrt(innerL2(f, f, a, b, n));

/** ∫_a^b xⁱ⁺ʲ dx in closed form. */
const monoInner = (k: number, a: number, b: number) => (b ** (k + 1) - a ** (k + 1)) / (k + 1);

/** Exact ⟨p, q⟩ on [a, b] for polynomials. */
export function polyInner(p: Poly, q: Poly, a: number, b: number): number {
  let s = 0;
  p.forEach((x, i) => q.forEach((y, j) => { s += x * y * monoInner(i + j, a, b); }));
  return s;
}

/** Gram–Schmidt on 1, x, …, xⁿ in L²[a, b]: an orthonormal basis of polynomials of degree ≤ n. */
export function orthonormalPolys(n: number, a: number, b: number): Poly[] {
  const out: Poly[] = [];
  for (let k = 0; k <= n; k++) {
    let p: Poly = Array.from({ length: k + 1 }, (_, i) => (i === k ? 1 : 0));
    for (const e of out) {
      const c = polyInner(p, e, a, b);
      p = p.map((x, i) => x - c * (e[i] ?? 0));
    }
    const nr = Math.sqrt(polyInner(p, p, a, b));
    out.push(p.map((x) => x / nr));
  }
  return out;
}

/** Legendre polynomial Pₙ(x) on [−1, 1] (Pₙ(1) = 1) by Bonnet's recurrence. */
export function legendre(n: number, x: number): number {
  if (n === 0) return 1;
  let p0 = 1, p1 = x;
  for (let k = 1; k < n; k++) [p0, p1] = [p1, ((2 * k + 1) * x * p1 - k * p0) / (k + 1)];
  return p1;
}

/**
 * The orthogonal projection of f onto polynomials of degree ≤ n in L²[a, b] (the least-squares polynomial),
 * and the distance ‖f − Pf‖ = √(‖f‖² − Σ⟨f, eₖ⟩²).
 */
export function projectOntoPolys(f: (x: number) => number, n: number, a: number, b: number, quad = 4000): { poly: Poly; dist: number } {
  const basis = orthonormalPolys(n, a, b);
  const poly: Poly = Array(n + 1).fill(0);
  let captured = 0;
  for (const e of basis) {
    const c = innerL2(f, (x) => polyEval(e, x), a, b, quad);
    captured += c * c;
    e.forEach((x, i) => { poly[i] += c * x; });
  }
  const total = innerL2(f, f, a, b, quad);
  return { poly, dist: Math.sqrt(Math.max(0, total - captured)) };
}

/** The Bessel sum a₀²/2 + Σ_{n ≤ N}(aₙ² + bₙ²), to compare with (1/π)∫f² (Parseval: equality as N → ∞). */
export const besselSum = (c: { a: number[]; b: number[] }, N: number): number => {
  let s = c.a[0] ** 2 / 2;
  for (let n = 1; n <= N; n++) s += (c.a[n] ?? 0) ** 2 + (c.b[n] ?? 0) ** 2;
  return s;
};
