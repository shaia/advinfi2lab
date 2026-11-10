/**
 * Differential geometry of curves and surfaces, as numerical probes: derivatives by high-order finite
 * differences, curvature and torsion, the Frenet frame, the curve rebuilt from its curvature (and torsion),
 * the two fundamental forms, Gauss / mean / principal / normal / geodesic curvature, area and total curvature.
 *
 * MODEL SPECIFICATION
 * - System: a parametrized curve γ: I → ℝ³ (a plane curve is γ with z = 0) and a parametrized surface
 *   σ: D ⊂ ℝ² → ℝ³, both given as plain functions.
 * - Dynamics: none, except curveFromCurvature / planeCurveFromCurvature, which integrate the Frenet–Serret
 *   system t′ = κn, n′ = −κt + τb, b′ = −τn (the course's sign: b′ = −τn, a right-handed helix has τ > 0),
 *   γ′ = t, by classical RK4 in the arc-length parameter.
 * - Boundary: derivatives use symmetric stencils, so the evaluation point must be interior with room for 3h.
 * - Conventions: frame t, n, b with b = t × n; N̂ = σ_u × σ_v / ‖σ_u × σ_v‖; Q₁ = E du² + 2F du dv + G dv²,
 *   Q₂ = L du² + 2M du dv + N dv² with L = σ_uu·N̂, M = σ_uv·N̂, N = σ_vv·N̂; K = (LN − M²)/(EG − F²),
 *   H = (EN − 2FM + GL) / (2(EG − F²)), κ₁ ≥ κ₂ = H ± √(H² − K). H and κᵢ change sign with N̂; K does not.
 * - Ignored: rounding analysis beyond the stated stencils; points where the curve is not regular, κ = 0
 *   (the frame is undefined there), or the surface is not regular.
 * - Valid when: γ and σ are smooth (C³ for torsion, C² otherwise) near the point; step h ≈ 1e-3 for first and
 *   second derivatives (error ~1e-10), 1e-2 for the third (error ~1e-8) on functions of size ~1.
 * - Failure modes: at a cusp or a pole of the parametrization the formulas divide by ~0 and return garbage;
 *   at an inflection point (κ = 0) torsion and the frame mean nothing.
 *
 * A probe is evidence, never proof: course claims come from the proof, and these numbers recompute keys.
 */

import { cross3, dot3, len3, scale3, add3, type Vec3 } from './vec';
import { simpson } from './multivar';

export type Curve = (t: number) => Vec3;
export type Surface = (u: number, v: number) => Vec3;

const comb = (terms: [number, Vec3][]): Vec3 => terms.reduce<Vec3>((s, [c, p]) => add3(s, scale3(p, c)), [0, 0, 0]);

/** γ′(t), five-point stencil, error O(h⁴). */
export const d1 = (g: Curve, t: number, h = 1e-3): Vec3 =>
  scale3(comb([[-1, g(t + 2 * h)], [8, g(t + h)], [-8, g(t - h)], [1, g(t - 2 * h)]]), 1 / (12 * h));

/** γ″(t), five-point stencil, error O(h⁴). */
export const d2 = (g: Curve, t: number, h = 1e-3): Vec3 =>
  scale3(comb([[-1, g(t + 2 * h)], [16, g(t + h)], [-30, g(t)], [16, g(t - h)], [-1, g(t - 2 * h)]]), 1 / (12 * h * h));

/** γ‴(t), seven-point stencil, error O(h⁴). */
export const d3 = (g: Curve, t: number, h = 1e-2): Vec3 =>
  scale3(comb([[-1, g(t + 3 * h)], [8, g(t + 2 * h)], [-13, g(t + h)], [13, g(t - h)], [-8, g(t - 2 * h)], [1, g(t - 3 * h)]]), 1 / (8 * h ** 3));

/** Length of γ on [a, b]: ∫‖γ′‖ by composite Simpson. */
export const arcLength = (g: Curve, a: number, b: number, n = 2000): number => simpson((t) => len3(d1(g, t)), a, b, n);

/** Curvature κ = ‖γ′ × γ″‖ / ‖γ′‖³ (any regular parameter). */
export function curvature(g: Curve, t: number): number {
  const v = d1(g, t);
  return len3(cross3(v, d2(g, t))) / len3(v) ** 3;
}

/** Signed curvature of a plane curve (x, y, 0): k = (x′y″ − y′x″) / (x′² + y′²)^{3/2}; k > 0 turning left. */
export function signedCurvature(g: Curve, t: number): number {
  const v = d1(g, t);
  const a = d2(g, t);
  return (v[0] * a[1] - v[1] * a[0]) / Math.hypot(v[0], v[1]) ** 3;
}

/** Torsion τ = (γ′ × γ″)·γ‴ / ‖γ′ × γ″‖², with the course's sign b′ = −τn. Undefined where κ = 0. */
export function torsion(g: Curve, t: number): number {
  const c = cross3(d1(g, t), d2(g, t));
  return dot3(c, d3(g, t)) / dot3(c, c);
}

const unit = (v: Vec3): Vec3 => scale3(v, 1 / len3(v));

/** The Frenet frame {t, n, b} at a point with κ > 0. */
export function frenet(g: Curve, t: number): { t: Vec3; n: Vec3; b: Vec3 } {
  const v = d1(g, t);
  const T = unit(v);
  const B = unit(cross3(v, d2(g, t)));
  return { t: T, n: cross3(B, T), b: B };
}

/** Centre of the osculating circle: γ + n/κ. */
export const osculatingCentre = (g: Curve, t: number): Vec3 => add3(g(t), scale3(frenet(g, t).n, 1 / curvature(g, t)));

/** Classical RK4 for y′ = f(s, y), y a vector, from s0 to s1 in n steps; returns the samples. */
export function rk4System(f: (s: number, y: number[]) => number[], s0: number, y0: number[], s1: number, n = 2000): { s: number[]; y: number[][] } {
  const h = (s1 - s0) / n;
  const S = [s0];
  const Y = [y0.slice()];
  let y = y0.slice();
  const axpy = (a: number[], k: number[], c: number) => a.map((x, i) => x + c * k[i]);
  for (let i = 0; i < n; i++) {
    const s = s0 + i * h;
    const k1 = f(s, y);
    const k2 = f(s + h / 2, axpy(y, k1, h / 2));
    const k3 = f(s + h / 2, axpy(y, k2, h / 2));
    const k4 = f(s + h, axpy(y, k3, h));
    y = y.map((x, j) => x + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    S.push(s + h);
    Y.push(y);
  }
  return { s: S, y: Y };
}

/**
 * The space curve with curvature κ(s) > 0 and torsion τ(s), arc length s ∈ [0, len], starting at p0 with
 * frame (t0, n0, b0) (default: the standard basis). Returns the points γ(s) on a uniform grid.
 */
export function curveFromCurvature(
  kappa: (s: number) => number,
  tau: (s: number) => number,
  len: number,
  n = 2000,
  p0: Vec3 = [0, 0, 0],
  frame: [Vec3, Vec3, Vec3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
): Vec3[] {
  const f = (s: number, y: number[]) => {
    const T = y.slice(3, 6), N = y.slice(6, 9), B = y.slice(9, 12);
    const k = kappa(s), w = tau(s);
    return [...T, ...N.map((x) => k * x), ...T.map((x, i) => -k * x + w * B[i]), ...N.map((x) => -w * x)];
  };
  const { y } = rk4System(f, 0, [...p0, ...frame[0], ...frame[1], ...frame[2]], len, n);
  return y.map((r) => [r[0], r[1], r[2]] as Vec3);
}

/** The plane curve with signed curvature k(s): θ′ = k, x′ = cos θ, y′ = sin θ, from the origin heading along x. */
export function planeCurveFromCurvature(k: (s: number) => number, len: number, n = 2000, theta0 = 0): Vec3[] {
  const { y } = rk4System((s, Y) => [Math.cos(Y[2]), Math.sin(Y[2]), k(s)], 0, [0, 0, theta0], len, n);
  return y.map((r) => [r[0], r[1], 0] as Vec3);
}

/* ---------------- surfaces ---------------- */

/** Partial derivatives of σ at (u, v): σ_u, σ_v, σ_uu, σ_uv, σ_vv. */
export function partials(s: Surface, u: number, v: number, h = 1e-3) {
  const cu: Curve = (x) => s(x, v);
  const cv: Curve = (y) => s(u, y);
  const su: Curve = (y) => d1((x) => s(x, y), u, h);
  return { su: d1(cu, u, h), sv: d1(cv, v, h), suu: d2(cu, u, h), svv: d2(cv, v, h), suv: d1(su, v, h) };
}

/** Unit normal N̂ = σ_u × σ_v / ‖σ_u × σ_v‖. */
export function unitNormal(s: Surface, u: number, v: number): Vec3 {
  const { su, sv } = partials(s, u, v);
  return unit(cross3(su, sv));
}

/** Both fundamental forms at (u, v): E, F, G and L, M, N, with the normal N̂. */
export function fundamentalForms(s: Surface, u: number, v: number) {
  const p = partials(s, u, v);
  const nrm = unit(cross3(p.su, p.sv));
  return {
    E: dot3(p.su, p.su), F: dot3(p.su, p.sv), G: dot3(p.sv, p.sv),
    L: dot3(p.suu, nrm), M: dot3(p.suv, nrm), N: dot3(p.svv, nrm),
    normal: nrm,
  };
}

/** Gauss curvature, mean curvature and principal curvatures κ₁ ≥ κ₂ (signs of H, κᵢ follow N̂). */
export function curvatures(s: Surface, u: number, v: number): { K: number; H: number; k1: number; k2: number } {
  const { E, F, G, L, M, N } = fundamentalForms(s, u, v);
  const W = E * G - F * F;
  const K = (L * N - M * M) / W;
  const H = (E * N - 2 * F * M + G * L) / (2 * W);
  const r = Math.sqrt(Math.max(0, H * H - K));
  return { K, H, k1: H + r, k2: H - r };
}

/** Normal curvature in the direction (du, dv): Q₂/Q₁. */
export function normalCurvature(s: Surface, u: number, v: number, du: number, dv: number): number {
  const { E, F, G, L, M, N } = fundamentalForms(s, u, v);
  return (L * du * du + 2 * M * du * dv + N * dv * dv) / (E * du * du + 2 * F * du * dv + G * dv * dv);
}

/**
 * Normal and geodesic curvature of the curve t ↦ σ(c(t)) on the surface: κₙ = γ″·N̂ / ‖γ′‖²,
 * κ_g = γ″·(N̂ × γ′) / ‖γ′‖³, so κ² = κₙ² + κ_g².
 */
export function curveOnSurface(s: Surface, c: (t: number) => [number, number], t: number): { kn: number; kg: number; k: number } {
  const g: Curve = (x) => { const [u, v] = c(x); return s(u, v); };
  const [u, v] = c(t);
  const nrm = unitNormal(s, u, v);
  const vel = d1(g, t);
  const acc = d2(g, t);
  const sp = len3(vel);
  return { kn: dot3(acc, nrm) / sp ** 2, kg: dot3(acc, cross3(nrm, vel)) / sp ** 3, k: curvature(g, t) };
}

/** Composite Simpson in two variables on [a, b] × [c, d] (n even, per axis). */
export function simpson2(f: (u: number, v: number) => number, a: number, b: number, c: number, d: number, n = 200): number {
  return simpson((u) => simpson((v) => f(u, v), c, d, n), a, b, n);
}

/** Area of σ over [a, b] × [c, d]: ∬ √(EG − F²) du dv. */
export function surfaceArea(s: Surface, a: number, b: number, c: number, d: number, n = 200): number {
  return simpson2((u, v) => { const { su, sv } = partials(s, u, v); return len3(cross3(su, sv)); }, a, b, c, d, n);
}

/** Total curvature ∬ K dS over [a, b] × [c, d]. */
export function totalCurvature(s: Surface, a: number, b: number, c: number, d: number, n = 200): number {
  return simpson2((u, v) => {
    const { E, F, G } = fundamentalForms(s, u, v);
    return curvatures(s, u, v).K * Math.sqrt(E * G - F * F);
  }, a, b, c, d, n);
}

/** Sample surfaces of the course (the "test objects"), with the parametrizations the questions use. */
export const SURFACES = {
  sphere: (r: number): Surface => (u, v) => [r * Math.cos(u) * Math.cos(v), r * Math.sin(u) * Math.cos(v), r * Math.sin(v)],
  cylinder: (r: number): Surface => (u, v) => [r * Math.cos(u), r * Math.sin(u), v],
  torus: (R: number, r: number): Surface => (u, v) => [(R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)],
  catenoid: (c: number): Surface => (u, v) => [c * Math.cosh(v / c) * Math.cos(u), c * Math.cosh(v / c) * Math.sin(u), v],
  helicoid: (c: number): Surface => (u, v) => [v * Math.cos(u), v * Math.sin(u), c * u],
  graph: (f: (x: number, y: number) => number): Surface => (x, y) => [x, y, f(x, y)],
} as const;

export const CURVES = {
  circle: (r: number): Curve => (t) => [r * Math.cos(t), r * Math.sin(t), 0],
  helix: (a: number, b: number): Curve => (t) => [a * Math.cos(t), a * Math.sin(t), b * t],
  cycloid: (r: number): Curve => (t) => [r * (t - Math.sin(t)), r * (1 - Math.cos(t)), 0],
  twistedCubic: (): Curve => (t) => [t, t * t, t ** 3],
} as const;

