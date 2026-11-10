/**
 * Vector calculus in ℝ² and ℝ³ as numerical probes: grad, curl, div by finite differences, line integrals
 * of functions and of fields, flux through a parametrized surface, and integrals over boxes, so that the
 * theorems of Green, Stokes and Gauss can be checked on examples and every key recomputed.
 *
 * MODEL SPECIFICATION
 * - System: scalar fields φ: ℝ³ → ℝ, vector fields F: ℝ³ → ℝ³ (a plane field is F with third component 0,
 *   independent of z), curves γ: [a, b] → ℝ³, surfaces σ: [a, b] × [c, d] → ℝ³.
 * - Dynamics: none; every function evaluates a definition with central differences or composite Simpson.
 * - Conventions: ∫F·ds = ∫ F(γ(t))·γ′(t) dt follows the curve's own direction; ∬F·dS = ∬ F(σ)·(σ_u × σ_v)
 *   follows the parametrization's normal (flip u and v, or the sign, for the other orientation).
 * - Ignored: rounding analysis; singular fields (the winding field at the origin) must be kept off the path.
 * - Valid when: fields and parametrizations are smooth on and near the domain; a corner of a piecewise curve or
 *   surface is passed as separate pieces.
 * - Failure modes: a field with a singularity inside a box gives a meaningless box integral; Simpson across a
 *   kink loses its order.
 *
 * A probe is evidence, never proof: course claims come from the proof, and these numbers recompute keys.
 */

import { cross3, dot3, len3, type Vec3 } from './vec';
import { simpson } from './multivar';
import { d1, partials, simpson2, type Curve, type Surface } from './geometry';

export type Scalar3 = (p: Vec3) => number;
export type Field3 = (p: Vec3) => Vec3;

const shift = (p: Vec3, i: number, h: number): Vec3 => [i === 0 ? p[0] + h : p[0], i === 1 ? p[1] + h : p[1], i === 2 ? p[2] + h : p[2]];

/** ∂_i of a scalar field (five-point stencil). */
export function partialAt(f: Scalar3, p: Vec3, i: number, h = 1e-3): number {
  return (-f(shift(p, i, 2 * h)) + 8 * f(shift(p, i, h)) - 8 * f(shift(p, i, -h)) + f(shift(p, i, -2 * h))) / (12 * h);
}

export const grad = (f: Scalar3, p: Vec3): Vec3 => [partialAt(f, p, 0), partialAt(f, p, 1), partialAt(f, p, 2)];

/** ∂_i F_j: component j of F differentiated in direction i. */
const dF = (F: Field3, p: Vec3, i: number, j: number) => partialAt((q) => F(q)[j], p, i);

export const div = (F: Field3, p: Vec3): number => dF(F, p, 0, 0) + dF(F, p, 1, 1) + dF(F, p, 2, 2);

export const curl = (F: Field3, p: Vec3): Vec3 => [
  dF(F, p, 1, 2) - dF(F, p, 2, 1),
  dF(F, p, 2, 0) - dF(F, p, 0, 2),
  dF(F, p, 0, 1) - dF(F, p, 1, 0),
];

/** ∫_γ ρ ds over [a, b]. */
export const scalarLineIntegral = (rho: Scalar3, g: Curve, a: number, b: number, n = 2000): number =>
  simpson((t) => rho(g(t)) * len3(d1(g, t)), a, b, n);

/** ∫_γ F·ds over [a, b], in the direction of increasing t. */
export const lineIntegral = (F: Field3, g: Curve, a: number, b: number, n = 2000): number =>
  simpson((t) => dot3(F(g(t)), d1(g, t)), a, b, n);

/** ∬_σ ρ dS over [a, b] × [c, d]. */
export const scalarSurfaceIntegral = (rho: Scalar3, s: Surface, a: number, b: number, c: number, d: number, n = 200): number =>
  simpson2((u, v) => { const { su, sv } = partials(s, u, v); return rho(s(u, v)) * len3(cross3(su, sv)); }, a, b, c, d, n);

/** ∬_σ F·dS over [a, b] × [c, d], with the normal σ_u × σ_v. */
export const flux = (F: Field3, s: Surface, a: number, b: number, c: number, d: number, n = 200): number =>
  simpson2((u, v) => { const { su, sv } = partials(s, u, v); return dot3(F(s(u, v)), cross3(su, sv)); }, a, b, c, d, n);

/** ∭ f over the box [x0, x1] × [y0, y1] × [z0, z1]. */
export function boxIntegral(f: Scalar3, [x0, x1]: [number, number], [y0, y1]: [number, number], [z0, z1]: [number, number], n = 60): number {
  return simpson((x) => simpson((y) => simpson((z) => f([x, y, z]), z0, z1, n), y0, y1, n), x0, x1, n);
}

/** The winding (rotation) field (−y, x, 0)/(x² + y²): curl 0 off the z-axis, circulation 2π around it. */
export const windingField: Field3 = ([x, y]) => { const r2 = x * x + y * y; return [-y / r2, x / r2, 0]; };

/** The inverse-square field p/‖p‖³: div 0 off the origin, flux 4π through any sphere around it. */
export const inverseSquare: Field3 = (p) => { const r = len3(p); return [p[0] / r ** 3, p[1] / r ** 3, p[2] / r ** 3]; };
