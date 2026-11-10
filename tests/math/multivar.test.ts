/**
 * The probes in src/math/multivar.ts, filed by accuracy category. Each test is named after the
 * mathematical claim it checks.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  banachBound,
  bernstein,
  definiteness,
  det,
  dirichletKernel,
  fejerKernel,
  fixedPoint,
  fourierCoeffs,
  fourierPartial,
  gradient,
  hessian,
  inverse,
  jacobian,
  l1Dist,
  leadingMinors,
  matMul,
  newtonN,
  opNorm,
  picard,
  pNorm,
  rk4,
  simpson,
  supDist,
  symEigenvalues,
} from '~/math/multivar';

describe('exact identities', () => {
  it('the 1-, 2- and ∞-norms of (3, −4) are 7, 5 and 4', () => {
    expect(pNorm([3, -4], 1)).toBe(7);
    expect(pNorm([3, -4], 2)).toBe(5);
    expect(pNorm([3, -4], Infinity)).toBe(4);
  });
  it('‖x‖_∞ ≤ ‖x‖_2 ≤ ‖x‖_1 ≤ n‖x‖_∞ on random vectors of ℝ⁴', () => {
    for (let k = 0; k < 50; k++) {
      const x = Array.from({ length: 4 }, (_, i) => Math.sin(7 * k + 3 * i) * 5);
      expect(pNorm(x, Infinity)).toBeLessThanOrEqual(pNorm(x, 2) + 1e-12);
      expect(pNorm(x, 2)).toBeLessThanOrEqual(pNorm(x, 1) + 1e-12);
      expect(pNorm(x, 1)).toBeLessThanOrEqual(4 * pNorm(x, Infinity) + 1e-12);
    }
  });
  it('the operator norms of [[1, 2], [3, 4]] are 6 (p = 1), 7 (p = ∞) and √(15 + √221) (p = 2)', () => {
    const A = [[1, 2], [3, 4]];
    expect(opNorm(A, 1)).toBe(6);
    expect(opNorm(A, Infinity)).toBe(7);
    expect(relativeError(opNorm(A, 2), Math.sqrt(15 + Math.sqrt(221)))).toBeLessThan(1e-12);
  });
  it('det, inverse and A·A⁻¹ = I agree for a 3×3 matrix', () => {
    const A = [[2, 1, 0], [1, 3, 1], [0, 1, 4]];
    expect(relativeError(det(A), 18)).toBeLessThan(1e-12);
    const P = matMul(A, inverse(A));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(Math.abs(P[i][j] - (i === j ? 1 : 0))).toBeLessThan(1e-12);
  });
  it('the eigenvalues of [[2, 1], [1, 2]] are 1 and 3, and its leading minors are 2 and 3', () => {
    const ev = symEigenvalues([[2, 1], [1, 2]]);
    expect(Math.abs(ev[0] - 1)).toBeLessThan(1e-12);
    expect(Math.abs(ev[1] - 3)).toBeLessThan(1e-12);
    expect(leadingMinors([[2, 1], [1, 2]])).toEqual([2, 3]);
  });
  it('the Hessian of x² − y² is indefinite and that of x² + xy + y² positive definite', () => {
    expect(definiteness([[2, 0], [0, -2]])).toBe('indefinite');
    expect(definiteness([[2, 1], [1, 2]])).toBe('positive');
    expect(definiteness([[1, 1], [1, 1]])).toBe('semi-positive');
  });
  it('the Dirichlet kernel is 2N + 1 at 0 and the Fejér kernel is the mean of D_0 … D_N', () => {
    expect(dirichletKernel(5, 0)).toBe(11);
    for (const t of [0.3, 1.1, 2.9]) {
      const mean = Array.from({ length: 7 }, (_, k) => dirichletKernel(k, t)).reduce((s, x) => s + x, 0) / 7;
      expect(relativeError(fejerKernel(6, t), mean)).toBeLessThan(1e-12);
    }
  });
  it('Bernstein polynomials reproduce linear functions exactly', () => {
    for (const x of [0, 0.25, 0.7, 1]) expect(Math.abs(bernstein((t) => 3 * t - 1, 9, x) - (3 * x - 1))).toBeLessThan(1e-12);
  });
});

describe('analytic limits', () => {
  it('the gradient and Hessian of x²y + y³ at (1, 2) are (4, 13) and [[4, 2], [2, 12]]', () => {
    const f = ([x, y]: readonly number[]) => x * x * y + y ** 3;
    const g = gradient(f, [1, 2]);
    expect(relativeError(g[0], 4)).toBeLessThan(1e-8);
    expect(relativeError(g[1], 13)).toBeLessThan(1e-8);
    const H = hessian(f, [1, 2]);
    [[4, 2], [2, 12]].forEach((r, i) => r.forEach((v, j) => expect(relativeError(H[i][j], v)).toBeLessThan(1e-5)));
  });
  it('the Jacobian of polar coordinates (r cos θ, r sin θ) has determinant r', () => {
    const J = jacobian(([r, t]) => [r * Math.cos(t), r * Math.sin(t)], [2, 0.7]);
    expect(relativeError(det(J), 2)).toBeLessThan(1e-9);
  });
  it('the Fourier sine coefficients of x on [−π, π] are 2(−1)^{k+1}/k', () => {
    const c = fourierCoeffs((x) => x, 6);
    for (let k = 1; k <= 6; k++) expect(relativeError(c.b[k], (2 * (-1) ** (k + 1)) / k)).toBeLessThan(1e-9);
    expect(Math.abs(c.a[3])).toBeLessThan(1e-12);
  });
  it('the square wave sign(x) has b_k = 4/(πk) for odd k and 0 for even k', () => {
    const c = fourierCoeffs(Math.sign, 5, [0]);
    expect(relativeError(c.b[1], 4 / Math.PI)).toBeLessThan(1e-9);
    expect(relativeError(c.b[3], 4 / (3 * Math.PI))).toBeLessThan(1e-9);
    expect(Math.abs(c.b[2])).toBeLessThan(1e-9);
  });
  it('x = cos x has the fixed point 0.7390851332…, reached by iteration', () => {
    expect(Math.abs(fixedPoint(Math.cos, 1).x - 0.7390851332151607)).toBeLessThan(1e-12);
  });
  it('Picard iterates of y′ = y, y(0) = 1 are the Taylor polynomials of eᵗ', () => {
    const { iterates } = picard((_t, y) => y, 0, 1, 1, 3, 4000);
    expect(Math.abs(iterates[3].at(-1)! - (1 + 1 + 1 / 2 + 1 / 6))).toBeLessThan(1e-6);
  });
  it('RK4 solves y′ = y² from y(0) = 1 to y(0.5) = 2 (the blow-up solution 1/(1 − t))', () => {
    expect(relativeError(rk4((_t, y) => y * y, 0, 1, 0.5), 2)).toBeLessThan(1e-9);
  });
  it('Newton in ℝ² finds the intersection (1/√2, 1/√2) of the unit circle and the line y = x', () => {
    const [x, y] = newtonN(([x, y]) => [x * x + y * y - 1, x - y], [1, 0.5]);
    expect(relativeError(x, Math.SQRT1_2)).toBeLessThan(1e-12);
    expect(relativeError(y, Math.SQRT1_2)).toBeLessThan(1e-12);
  });
});

describe('convergence', () => {
  it('Simpson integrates sin on [0, π] to 2 with error below 1e-12', () => {
    expect(Math.abs(simpson(Math.sin, 0, Math.PI) - 2)).toBeLessThan(1e-12);
  });
  it('Fourier partial sums of x at x = π/2 approach π/2', () => {
    const c = fourierCoeffs((x) => x, 400);
    expect(Math.abs(fourierPartial(c, 400, Math.PI / 2) - Math.PI / 2)).toBeLessThan(0.01);
  });
  it('xⁿ → 0 in L¹[0,1] (distance 1/(n+1)) but not uniformly (sup distance stays near 1)', () => {
    const n = 50;
    expect(relativeError(l1Dist((x) => x ** n, () => 0, 0, 1), 1 / (n + 1))).toBeLessThan(1e-6);
    expect(supDist((x) => x ** n, () => 0, 0, 1)).toBeGreaterThan(0.99);
  });
  it("Banach's a-priori bound dominates the true error of the iteration of cos/2", () => {
    const g = (x: number) => Math.cos(x) / 2;
    const star = fixedPoint(g, 0).x;
    let x = 0;
    const d01 = Math.abs(g(0) - 0);
    for (let n = 1; n <= 10; n++) {
      x = g(x);
      expect(Math.abs(x - star)).toBeLessThanOrEqual(banachBound(0.5, n, d01) + 1e-15);
    }
  });
  it('Bernstein polynomials of |x − 1/2| converge uniformly, slowly (sup error below 0.03 at n = 400)', () => {
    const f = (x: number) => Math.abs(x - 0.5);
    expect(supDist((x) => bernstein(f, 400, x), f, 0, 1, 2001)).toBeLessThan(0.03);
  });
});
