/**
 * Numerical probes for advanced calculus: norms and operator norms, small symmetric eigenproblems,
 * finite-difference gradients, Jacobians and Hessians, quadrature, Fourier coefficients, contraction
 * iterates and Picard iterates. Pure TS, no DOM.
 *
 * MODEL SPECIFICATION
 * - System: vectors in ℝⁿ as number arrays, matrices as arrays of rows, real functions on intervals or on ℝⁿ.
 * - Dynamics: none; every function evaluates a definition or a standard numerical scheme
 *   (central differences, composite Simpson, cyclic Jacobi rotations, fixed-point iteration).
 * - Boundary: Fourier coefficients use the period [−π, π]; Picard iterates live on a uniform grid of [t0, t1].
 * - Ignored: rounding error analysis beyond the stated tolerances; non-symmetric eigenproblems.
 * - Valid when: functions are smooth near the evaluation point (differences), continuous on the interval
 *   (Simpson; a jump costs accuracy, so pass the jump as an endpoint), matrices are small (n ≤ 10).
 * - Failure modes: differences of non-smooth functions (|x| at 0) return a number that means nothing;
 *   Jacobi on a non-symmetric matrix silently symmetrises nothing and is wrong.
 *
 * A probe is evidence, never proof: course claims come from the proof, and these numbers recompute keys.
 */

export type Vec = readonly number[];
export type Mat = readonly (readonly number[])[];
export type FnN = (x: Vec) => number;
export type MapN = (x: Vec) => number[];

/** The p-norm of a vector, p ≥ 1 or Infinity. */
export function pNorm(v: Vec, p: number): number {
  if (p === Infinity) return Math.max(0, ...v.map(Math.abs));
  if (p < 1) throw new Error('pNorm: p must be ≥ 1 (for p < 1 the triangle inequality fails)');
  return v.reduce((s, x) => s + Math.abs(x) ** p, 0) ** (1 / p);
}

export const sub = (a: Vec, b: Vec): number[] => a.map((x, i) => x - b[i]);
export const add = (a: Vec, b: Vec): number[] => a.map((x, i) => x + b[i]);
export const scale = (a: Vec, s: number): number[] => a.map((x) => x * s);
export const dot = (a: Vec, b: Vec): number => a.reduce((s, x, i) => s + x * b[i], 0);

/** The distance induced by the p-norm. */
export const pDist = (a: Vec, b: Vec, p: number): number => pNorm(sub(a, b), p);

export const transpose = (A: Mat): number[][] => A[0].map((_, j) => A.map((r) => r[j]));
export const matVec = (A: Mat, v: Vec): number[] => A.map((r) => dot(r, v));
export const matMul = (A: Mat, B: Mat): number[][] => A.map((r) => transpose(B).map((c) => dot(r, c)));
export const identity = (n: number): number[][] => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

/** Determinant by Gaussian elimination with partial pivoting. */
export function det(A: Mat): number {
  const M = A.map((r) => [...r]);
  const n = M.length;
  let d = 1;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    if (M[p][k] === 0) return 0;
    if (p !== k) {
      [M[p], M[k]] = [M[k], M[p]];
      d = -d;
    }
    d *= M[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      for (let j = k; j < n; j++) M[i][j] -= f * M[k][j];
    }
  }
  return d;
}

/** Solves A x = b (Gaussian elimination, partial pivoting); throws on a singular matrix. */
export function solve(A: Mat, b: Vec): number[] {
  const n = A.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    if (Math.abs(M[p][k]) < 1e-14) throw new Error('solve: singular matrix');
    [M[p], M[k]] = [M[k], M[p]];
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

/** The inverse matrix, column by column. */
export const inverse = (A: Mat): number[][] => transpose(identity(A.length).map((e) => solve(A, e)));

/** Eigenvalues of a symmetric matrix by cyclic Jacobi rotations, ascending. */
export function symEigenvalues(A: Mat, tol = 1e-13, maxSweeps = 100): number[] {
  const n = A.length;
  const M = A.map((r) => [...r]);
  for (let s = 0; s < maxSweeps; s++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += M[i][j] ** 2;
    if (off < tol * tol) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(M[p][q]) < 1e-300) continue;
        const theta = (M[q][q] - M[p][p]) / (2 * M[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const sn = t * c;
        for (let k = 0; k < n; k++) {
          const a = M[k][p], b = M[k][q];
          M[k][p] = c * a - sn * b;
          M[k][q] = sn * a + c * b;
        }
        for (let k = 0; k < n; k++) {
          const a = M[p][k], b = M[q][k];
          M[p][k] = c * a - sn * b;
          M[q][k] = sn * a + c * b;
        }
      }
  }
  return M.map((r, i) => r[i]).sort((a, b) => a - b);
}

/** The leading principal minors Δ₁, …, Δₙ (Sylvester's criterion). */
export const leadingMinors = (A: Mat): number[] => A.map((_, k) => det(A.slice(0, k + 1).map((r) => r.slice(0, k + 1))));

/** Classifies a symmetric matrix's quadratic form by its eigenvalues (|λ| ≤ eps counts as 0). */
export function definiteness(A: Mat, eps = 1e-9): 'positive' | 'negative' | 'semi-positive' | 'semi-negative' | 'indefinite' | 'zero' {
  const ev = symEigenvalues(A);
  const pos = ev.some((l) => l > eps), neg = ev.some((l) => l < -eps), zero = ev.some((l) => Math.abs(l) <= eps);
  if (pos && neg) return 'indefinite';
  if (pos) return zero ? 'semi-positive' : 'positive';
  if (neg) return zero ? 'semi-negative' : 'negative';
  return 'zero';
}

/**
 * The operator norm of A from (ℝⁿ, ‖·‖_p) to (ℝᵐ, ‖·‖_p): exact for p = 1 (largest column sum),
 * p = ∞ (largest row sum) and p = 2 (square root of the largest eigenvalue of AᵀA).
 */
export function opNorm(A: Mat, p: 1 | 2 | typeof Infinity): number {
  if (p === Infinity) return Math.max(...A.map((r) => r.reduce((s, x) => s + Math.abs(x), 0)));
  if (p === 1) return opNorm(transpose(A), Infinity);
  return Math.sqrt(Math.max(0, ...symEigenvalues(matMul(transpose(A), A))));
}

/** Partial derivative ∂f/∂x_i at x by a central difference. */
export function partial(f: FnN, x: Vec, i: number, h = 1e-5): number {
  const xp = [...x], xm = [...x];
  xp[i] += h;
  xm[i] -= h;
  return (f(xp) - f(xm)) / (2 * h);
}

export const gradient = (f: FnN, x: Vec, h = 1e-5): number[] => x.map((_, i) => partial(f, x, i, h));

/** Directional derivative along v (not normalised: pass a unit vector for the usual definition). */
export const directional = (f: FnN, x: Vec, v: Vec, h = 1e-5): number => (f(add(x, scale(v, h))) - f(sub(x, scale(v, h)))) / (2 * h);

/** One-sided difference quotient (f(x + t v) − f(x)) / t: the definition, for points where f is not smooth. */
export const directionalQuotient = (f: FnN, x: Vec, v: Vec, t: number): number => (f(add(x, scale(v, t))) - f(x)) / t;

/** Jacobian matrix of F: ℝⁿ → ℝᵐ at x (rows = components). */
export function jacobian(F: MapN, x: Vec, h = 1e-5): number[][] {
  const m = F(x).length;
  const J = Array.from({ length: m }, () => new Array<number>(x.length).fill(0));
  for (let j = 0; j < x.length; j++) {
    const xp = [...x], xm = [...x];
    xp[j] += h;
    xm[j] -= h;
    const fp = F(xp), fm = F(xm);
    for (let i = 0; i < m; i++) J[i][j] = (fp[i] - fm[i]) / (2 * h);
  }
  return J;
}

/** Hessian of f at x by central second differences (symmetrised). */
export function hessian(f: FnN, x: Vec, h = 1e-4): number[][] {
  const n = x.length;
  const H = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const at = (di: number, dj: number, i: number, j: number) => {
    const y = [...x];
    y[i] += di;
    y[j] += dj;
    return f(y);
  };
  for (let i = 0; i < n; i++)
    for (let j = i; j < n; j++) {
      const v = i === j
        ? (at(h, 0, i, i) - 2 * f(x) + at(-h, 0, i, i)) / (h * h)
        : (at(h, h, i, j) - at(h, -h, i, j) - at(-h, h, i, j) + at(-h, -h, i, j)) / (4 * h * h);
      H[i][j] = H[j][i] = v;
    }
  return H;
}

/** Composite Simpson's rule on [a, b] with n (even) panels. */
export function simpson(f: (x: number) => number, a: number, b: number, n = 2000): number {
  if (n % 2) n++;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let k = 1; k < n; k++) s += (k % 2 ? 4 : 2) * f(a + k * h);
  return (s * h) / 3;
}

/** sup |f − g| over [a, b], sampled: a lower estimate of the sup norm of the difference. */
export function supDist(f: (x: number) => number, g: (x: number) => number, a: number, b: number, samples = 20_001): number {
  let m = 0;
  for (let k = 0; k < samples; k++) {
    const x = a + ((b - a) * k) / (samples - 1);
    m = Math.max(m, Math.abs(f(x) - g(x)));
  }
  return m;
}

/** ∫_a^b |f − g|: the L¹ distance on C[a, b]. */
export const l1Dist = (f: (x: number) => number, g: (x: number) => number, a: number, b: number, n = 4000): number =>
  simpson((x) => Math.abs(f(x) - g(x)), a, b, n);

/**
 * Real Fourier coefficients on [−π, π]: a_k = (1/π)∫ f cos kx, b_k = (1/π)∫ f sin kx, for k = 0…N
 * (b_0 = 0). `breaks` are jump points inside (−π, π): the integral is split there so Simpson stays accurate.
 */
export function fourierCoeffs(f: (x: number) => number, N: number, breaks: number[] = [], panels = 4000): { a: number[]; b: number[] } {
  const pts = [-Math.PI, ...breaks.filter((x) => x > -Math.PI && x < Math.PI).sort((x, y) => x - y), Math.PI];
  const integ = (g: (x: number) => number) => {
    let s = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      // nudge off the endpoints so a jump's one-sided value is used, not the value at the jump
      const lo = pts[i], hi = pts[i + 1], e = 1e-12 * (hi - lo);
      s += simpson(g, lo + e, hi - e, panels);
    }
    return s;
  };
  const a: number[] = [], b: number[] = [];
  for (let k = 0; k <= N; k++) {
    a.push(integ((x) => f(x) * Math.cos(k * x)) / Math.PI);
    b.push(k === 0 ? 0 : integ((x) => f(x) * Math.sin(k * x)) / Math.PI);
  }
  return { a, b };
}

/** The partial sum S_N(x) = a_0/2 + Σ_{k=1}^N (a_k cos kx + b_k sin kx). */
export const fourierPartial = (c: { a: number[]; b: number[] }, N: number, x: number): number =>
  c.a[0] / 2 + Array.from({ length: N }, (_, i) => i + 1).reduce((s, k) => s + c.a[k] * Math.cos(k * x) + c.b[k] * Math.sin(k * x), 0);

/** Dirichlet kernel D_N(t) = sin((N + 1/2)t) / sin(t/2) (= 2N + 1 at t = 0); S_N f = (1/2π) ∫ f(x − t) D_N(t) dt. */
export const dirichletKernel = (N: number, t: number): number =>
  Math.abs(Math.sin(t / 2)) < 1e-14 ? 2 * N + 1 : Math.sin((N + 0.5) * t) / Math.sin(t / 2);

/** Fejér kernel F_N(t) = (1/(N+1)) (sin((N+1)t/2) / sin(t/2))² (= N + 1 at t = 0), the mean of D_0…D_N. */
export const fejerKernel = (N: number, t: number): number =>
  Math.abs(Math.sin(t / 2)) < 1e-14 ? N + 1 : (Math.sin(((N + 1) * t) / 2) / Math.sin(t / 2)) ** 2 / (N + 1);

/** Iterates x_{k+1} = g(x_k) until |x_{k+1} − x_k| < tol; returns the last iterate and the count. */
export function fixedPoint(g: (x: number) => number, x0: number, tol = 1e-13, maxIter = 10_000): { x: number; iterations: number } {
  let x = x0;
  for (let k = 1; k <= maxIter; k++) {
    const y = g(x);
    if (Math.abs(y - x) < tol) return { x: y, iterations: k };
    x = y;
  }
  return { x, iterations: maxIter };
}

/** Banach's a-priori bound: d(x_n, x*) ≤ qⁿ/(1 − q) · d(x_1, x_0). */
export const banachBound = (q: number, n: number, d01: number): number => (q ** n / (1 - q)) * d01;

/**
 * Picard iterates for y' = f(t, y), y(t0) = y0 on [t0, t1]: y_{k+1}(t) = y0 + ∫_{t0}^t f(s, y_k(s)) ds,
 * starting from the constant y0, on a uniform grid of `grid` intervals (trapezoid rule). Returns the
 * grid and every iterate's values on it (iterates[0] is the constant y0).
 */
export function picard(f: (t: number, y: number) => number, t0: number, y0: number, t1: number, iterations: number, grid = 2000): { t: number[]; iterates: number[][] } {
  const t = Array.from({ length: grid + 1 }, (_, k) => t0 + ((t1 - t0) * k) / grid);
  const h = (t1 - t0) / grid;
  const iterates: number[][] = [t.map(() => y0)];
  for (let k = 0; k < iterations; k++) {
    const prev = iterates[k];
    const next = [y0];
    let acc = 0;
    for (let i = 1; i <= grid; i++) {
      acc += (h / 2) * (f(t[i - 1], prev[i - 1]) + f(t[i], prev[i]));
      next.push(y0 + acc);
    }
    iterates.push(next);
  }
  return { t, iterates };
}

/** Classical RK4 for y' = f(t, y) from t0 to t1 in n steps; returns y(t1). */
export function rk4(f: (t: number, y: number) => number, t0: number, y0: number, t1: number, n = 1000): number {
  const h = (t1 - t0) / n;
  let y = y0, t = t0;
  for (let i = 0; i < n; i++) {
    const k1 = f(t, y), k2 = f(t + h / 2, y + (h / 2) * k1), k3 = f(t + h / 2, y + (h / 2) * k2), k4 = f(t + h, y + h * k3);
    y += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    t += h;
  }
  return y;
}

/** Bernstein polynomial B_n f(x) = Σ f(k/n) C(n,k) x^k (1−x)^{n−k} on [0, 1]. */
export function bernstein(f: (x: number) => number, n: number, x: number): number {
  let s = 0, c = 1; // c = C(n, k)
  for (let k = 0; k <= n; k++) {
    s += f(k / n) * c * x ** k * (1 - x) ** (n - k);
    c = (c * (n - k)) / (k + 1);
  }
  return s;
}

/** Newton's method in ℝⁿ for F(x) = 0 with a finite-difference Jacobian. */
export function newtonN(F: MapN, x0: Vec, tol = 1e-12, maxIter = 100): number[] {
  let x = [...x0];
  for (let k = 0; k < maxIter; k++) {
    const Fx = F(x);
    if (pNorm(Fx, Infinity) < tol) return x;
    x = sub(x, solve(jacobian(F, x), Fx));
  }
  return x;
}
