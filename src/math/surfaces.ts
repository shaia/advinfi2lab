/**
 * Parametrized surfaces of chapter 3 with exact partial derivatives: the test objects the figure SurfacePatch draws
 * and the quantities lessons 3.1–3.5 compute on them (regularity, the tangent plane, the unit normal, the first
 * fundamental form, lengths of and angles between curves on a surface, isometric bending).
 *
 * MODEL SPECIFICATION
 * - System: a parametrization σ: [u0, u1] × [v0, v1] → ℝ³ given with σ_u, σ_v (and σ_uu, σ_uv, σ_vv for chapter 4)
 *   in closed form. No finite differences: the cone's vertex, the sphere's poles and the polar origin are exactly
 *   where a stencil would blur the degeneracy the lessons show.
 * - Quantities (course conventions, CLAUDE.md): regularity ‖σ_u × σ_v‖; unit normal N̂ = σ_u × σ_v / ‖σ_u × σ_v‖
 *   (null where ‖σ_u × σ_v‖ < 1e-12); E = σ_u·σ_u, F = σ_u·σ_v, G = σ_v·σ_v; Q₁(a, b) = Ea² + 2Fab + Gb²;
 *   the angle between the parameter curves cos θ = F/√(EG); the length of t ↦ σ(c(t)) is ∫ √Q₁(c′(t)) dt.
 * - Transformations: swapping the parameters σ̃(s, t) = σ(t, s) (the normal changes sign); the bending families
 *   `roll` (a plane strip rolled onto a cylinder) and `cone-roll` (a plane sector rolled onto a cone), whose
 *   E, F, G do not depend on the bending parameter λ: every member is isometric to the flat one.
 * - Ignored: global questions (injectivity, the seam of a closed surface) are the lesson's, not this module's;
 *   the domain rectangle is only what the figure draws.
 * - Valid when: inside the preset's rectangle; Simpson with n = 2000 gives ~1e-12 relative error for the smooth
 *   integrands of the presets' curves.
 * - Failure modes: at a non-regular point (sphere pole, cone vertex, polar origin, apex of the rolled cone) the normal
 *   is null and cos θ is NaN; the families use the series limit at λ = 0 (the flat strip), not a 0/0.
 *
 * A probe is evidence, never proof: lessons prove the identities, and these numbers recompute keys and drive figures.
 */

import { simpson } from './multivar';
import { cross3, dot3, len3, scale3, type Vec3 } from './vec';

export interface SurfaceDef {
  id: string;
  /** Hebrew name for a control */
  label: string;
  /** the formula as plain LTR text (figure readouts and aria labels) */
  formula: string;
  /** the parameter names as the lesson writes them */
  names: [string, string];
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  p: (u: number, v: number) => Vec3;
  su: (u: number, v: number) => Vec3;
  sv: (u: number, v: number) => Vec3;
  suu: (u: number, v: number) => Vec3;
  suv: (u: number, v: number) => Vec3;
  svv: (u: number, v: number) => Vec3;
  /** a bending family: the surface at bending parameter λ ∈ [0, 1] (λ = 0 is flat) */
  family?: (lambda: number) => SurfaceDef;
  /** the label of the bending slider */
  familyLabel?: string;
}

/** A curve in the parameter domain, t ↦ (u(t), v(t)), with its derivative. */
export interface DomainCurve {
  id: string;
  label: string;
  /** the formula as plain LTR text */
  formula: string;
  t0: number;
  t1: number;
  c: (t: number) => [number, number];
  dc: (t: number) => [number, number];
}

const { cos, sin, cosh, sinh, sqrt, PI } = Math;
const Z: Vec3 = [0, 0, 0];
const zero = () => Z;

/** The surface of revolution (f(v) cos u, f(v) sin u, g(v)) with f, f′, f″, g, g′, g″. */
function revolution(
  id: string, label: string, formula: string, v0: number, v1: number,
  f: (v: number) => number, f1: (v: number) => number, f2: (v: number) => number,
  g: (v: number) => number, g1: (v: number) => number, g2: (v: number) => number,
): SurfaceDef {
  return {
    id, label, formula, names: ['u', 'v'], u0: 0, u1: 2 * PI, v0, v1,
    p: (u, v) => [f(v) * cos(u), f(v) * sin(u), g(v)],
    su: (u, v) => [-f(v) * sin(u), f(v) * cos(u), 0],
    sv: (u, v) => [f1(v) * cos(u), f1(v) * sin(u), g1(v)],
    suu: (u, v) => [-f(v) * cos(u), -f(v) * sin(u), 0],
    suv: (u, v) => [-f1(v) * sin(u), f1(v) * cos(u), 0],
    svv: (u, v) => [f2(v) * cos(u), f2(v) * sin(u), g2(v)],
  };
}

/** The graph (x, y, h(x, y)) with h and its partials up to order 2. */
function graph(
  id: string, label: string, formula: string, half: number,
  h: (x: number, y: number) => number,
  hx: (x: number, y: number) => number, hy: (x: number, y: number) => number,
  hxx: (x: number, y: number) => number, hxy: (x: number, y: number) => number, hyy: (x: number, y: number) => number,
): SurfaceDef {
  return {
    id, label, formula, names: ['x', 'y'], u0: -half, u1: half, v0: -half, v1: half,
    p: (x, y) => [x, y, h(x, y)],
    su: (x, y) => [1, 0, hx(x, y)],
    sv: (x, y) => [0, 1, hy(x, y)],
    suu: (x, y) => [0, 0, hxx(x, y)],
    suv: (x, y) => [0, 0, hxy(x, y)],
    svv: (x, y) => [0, 0, hyy(x, y)],
  };
}

/**
 * A strip of the plane rolled onto a cylinder of radius 1/λ:
 * (sin(λx)/λ, (1 − cos(λx))/λ, y), x ∈ [−π, π], y ∈ [−0.1, 1.6] (room for the line y = 3/4 + x/4). λ = 0 is the flat strip (x, 0, y); λ = 1 closes it
 * into the unit cylinder. E = 1, F = 0, G = 1 for every λ.
 */
export function rolledStrip(lambda: number): SurfaceDef {
  const l = lambda;
  const S = (x: number) => (Math.abs(l) < 1e-9 ? x : sin(l * x) / l);
  const C = (x: number) => (Math.abs(l) < 1e-9 ? (l * x * x) / 2 : (1 - cos(l * x)) / l);
  return {
    id: 'roll', label: 'רצועה שמתגלגלת לגליל', formula: '(sin(λx)/λ, (1 − cos(λx))/λ, y)', names: ['x', 'y'],
    u0: -PI, u1: PI, v0: -0.1, v1: 1.6,
    p: (x, y) => [S(x), C(x), y],
    su: (x) => [cos(l * x), sin(l * x), 0],
    sv: () => [0, 0, 1],
    suu: (x) => [-l * sin(l * x), l * cos(l * x), 0],
    suv: zero,
    svv: zero,
    family: rolledStrip,
    familyLabel: 'גלגול λ',
  };
}

/** The sector angle of the course's cone z = √(x² + y²) cut along a generator and laid flat: 2π sin 45° · … = √2 π. */
export const CONE_SECTOR = sqrt(2) * PI;

/**
 * A sector of the plane of angle √2 π rolled onto a cone: in the parameters (r, φ), r ∈ [0, 1.5],
 * φ ∈ [−√2π/2, √2π/2], the point (r k cos(φ/k), r k sin(φ/k), r √(1 − k²)) with k = 1 − λ(1 − 1/√2).
 * λ = 0 (k = 1) is the flat sector in the plane z = 0; λ = 1 (k = 1/√2) closes it into the cone
 * (v cos u, v sin u, v) with v = r/√2, u = √2 φ. E = 1, F = 0, G = r² for every λ.
 */
export function rolledSector(lambda: number): SurfaceDef {
  const k = 1 - lambda * (1 - 1 / sqrt(2));
  const h = sqrt(Math.max(0, 1 - k * k));
  return {
    id: 'cone-roll', label: 'גזרה שמתגלגלת לחרוט', formula: '(rk cos(φ/k), rk sin(φ/k), r√(1 − k²))', names: ['r', 'φ'],
    u0: 0, u1: 1.5, v0: -CONE_SECTOR / 2, v1: CONE_SECTOR / 2,
    p: (r, f) => [r * k * cos(f / k), r * k * sin(f / k), r * h],
    su: (_r, f) => [k * cos(f / k), k * sin(f / k), h],
    sv: (r, f) => [-r * sin(f / k), r * cos(f / k), 0],
    suu: zero,
    suv: (_r, f) => [-sin(f / k), cos(f / k), 0],
    svv: (r, f) => [(-r / k) * cos(f / k), (-r / k) * sin(f / k), 0],
    family: rolledSector,
    familyLabel: 'גלגול λ',
  };
}

const R_TORUS = 3;
const r_TORUS = 1;

/** The chapter's surfaces. Each formula is exact; the lessons and the banks quote the same ones. */
export const SURFACES3: Record<string, SurfaceDef> = {
  plane: {
    id: 'plane', label: 'המישור', formula: '(u, v, 0)', names: ['u', 'v'], u0: -1, u1: 1, v0: -1, v1: 1,
    p: (u, v) => [u, v, 0], su: () => [1, 0, 0], sv: () => [0, 1, 0], suu: zero, suv: zero, svv: zero,
  },
  /** Q-3.4-oblique, Q-3-review-09: E = 1, F = 1, G = 2 */
  'plane-oblique': {
    id: 'plane-oblique', label: 'המישור, פרמטריזציה אלכסונית', formula: '(u + v, v, 0)', names: ['u', 'v'],
    u0: -1, u1: 1, v0: -1, v1: 1,
    p: (u, v) => [u + v, v, 0], su: () => [1, 0, 0], sv: () => [1, 1, 0], suu: zero, suv: zero, svv: zero,
  },
  /** polar coordinates: not regular at u = 0, although the plane is smooth there */
  'plane-polar': {
    id: 'plane-polar', label: 'המישור בקואורדינטות קוטביות', formula: '(u cos v, u sin v, 0)', names: ['u', 'v'],
    u0: 0, u1: 1.4, v0: 0, v1: 2 * PI,
    p: (u, v) => [u * cos(v), u * sin(v), 0],
    su: (_u, v) => [cos(v), sin(v), 0],
    sv: (u, v) => [-u * sin(v), u * cos(v), 0],
    suu: zero,
    suv: (_u, v) => [-sin(v), cos(v), 0],
    svv: (u, v) => [-u * cos(v), -u * sin(v), 0],
  },
  /** the course's sphere: u longitude, v latitude; σ_u × σ_v = cos v · σ, not regular at the poles v = ±π/2 */
  sphere: {
    id: 'sphere', label: 'ספרה, אורך ורוחב', formula: '(cos u cos v, sin u cos v, sin v)', names: ['u', 'v'],
    u0: 0, u1: 2 * PI, v0: -PI / 2, v1: PI / 2,
    p: (u, v) => [cos(u) * cos(v), sin(u) * cos(v), sin(v)],
    su: (u, v) => [-sin(u) * cos(v), cos(u) * cos(v), 0],
    sv: (u, v) => [-cos(u) * sin(v), -sin(u) * sin(v), cos(v)],
    suu: (u, v) => [-cos(u) * cos(v), -sin(u) * cos(v), 0],
    suv: (u, v) => [sin(u) * sin(v), -cos(u) * sin(v), 0],
    svv: (u, v) => [-cos(u) * cos(v), -sin(u) * cos(v), -sin(v)],
  },
  /** colatitude u from the north pole (Q-3.3-sphere-two, Q-3-exam-5): σ_u × σ_v = sin u · σ, E = 1, F = 0, G = sin²u */
  'sphere-colat': {
    id: 'sphere-colat', label: 'ספרה, קולטיטודה', formula: '(sin u cos v, sin u sin v, cos u)', names: ['u', 'v'],
    u0: 0, u1: PI, v0: 0, v1: 2 * PI,
    p: (u, v) => [sin(u) * cos(v), sin(u) * sin(v), cos(u)],
    su: (u, v) => [cos(u) * cos(v), cos(u) * sin(v), -sin(u)],
    sv: (u, v) => [-sin(u) * sin(v), sin(u) * cos(v), 0],
    suu: (u, v) => [-sin(u) * cos(v), -sin(u) * sin(v), -cos(u)],
    suv: (u, v) => [-cos(u) * sin(v), cos(u) * cos(v), 0],
    svv: (u, v) => [-sin(u) * cos(v), -sin(u) * sin(v), 0],
  },
  /** the upper hemisphere as a graph: regular at the pole (0, 0, 1) */
  'sphere-graph': graph(
    'sphere-graph', 'חצי ספרה כגרף', '(x, y, √(1 − x² − y²))', 0.65,
    (x, y) => sqrt(1 - x * x - y * y),
    (x, y) => -x / sqrt(1 - x * x - y * y),
    (x, y) => -y / sqrt(1 - x * x - y * y),
    (x, y) => -(1 - y * y) / (1 - x * x - y * y) ** 1.5,
    (x, y) => (-x * y) / (1 - x * x - y * y) ** 1.5,
    (x, y) => -(1 - x * x) / (1 - x * x - y * y) ** 1.5,
  ),
  cylinder: revolution('cylinder', 'גליל', '(cos u, sin u, v)', -1, 1, () => 1, () => 0, () => 0, (v) => v, () => 1, () => 0),
  /** the double cone: σ_u × σ_v = (v cos u, v sin u, −v), not regular at the vertex v = 0 */
  cone: revolution('cone', 'חרוט כפול', '(v cos u, v sin u, v)', -1.2, 1.2, (v) => v, () => 1, () => 0, (v) => v, () => 1, () => 0),
  torus: revolution(
    'torus', 'טורוס', '((3 + cos v) cos u, (3 + cos v) sin u, sin v)', 0, 2 * PI,
    (v) => R_TORUS + r_TORUS * cos(v), (v) => -r_TORUS * sin(v), (v) => -r_TORUS * cos(v),
    (v) => r_TORUS * sin(v), (v) => r_TORUS * cos(v), (v) => -r_TORUS * sin(v),
  ),
  catenoid: revolution('catenoid', 'קטנואיד', '(cosh v cos u, cosh v sin u, v)', -1.2, 1.2, cosh, sinh, cosh, (v) => v, () => 1, () => 0),
  /** the hyperboloid of one sheet x² + y² − z² = 1 (Q-3-exam-6) */
  hyperboloid: revolution('hyperboloid', 'היפרבולואיד', '(cosh v cos u, cosh v sin u, sinh v)', -1.2, 1.2, cosh, sinh, cosh, sinh, cosh, sinh),
  saddle: graph('saddle', 'אוכף z = x² − y²', '(x, y, x² − y²)', 1, (x, y) => x * x - y * y, (x) => 2 * x, (_x, y) => -2 * y, () => 2, () => 0, () => -2),
  'saddle-xy': graph('saddle-xy', 'אוכף z = xy', '(x, y, xy)', 1, (x, y) => x * y, (_x, y) => y, (x) => x, () => 0, () => 1, () => 0),
  /** the Möbius band of the bank: σ(u + 2π, −v) = σ(u, v), regular for |v| < 1, N̂(2π, 0) = −N̂(0, 0) */
  mobius: (() => {
    const A = (u: number, v: number) => 2 + v * cos(u / 2);
    const Au = (u: number, v: number) => (-v / 2) * sin(u / 2);
    const Auu = (u: number, v: number) => (-v / 4) * cos(u / 2);
    return {
      id: 'mobius', label: 'רצועת מביוס', formula: '((2 + v cos(u/2)) cos u, (2 + v cos(u/2)) sin u, v sin(u/2))',
      names: ['u', 'v'] as [string, string], u0: 0, u1: 2 * PI, v0: -0.9, v1: 0.9,
      p: (u: number, v: number): Vec3 => [A(u, v) * cos(u), A(u, v) * sin(u), v * sin(u / 2)],
      su: (u: number, v: number): Vec3 => [
        Au(u, v) * cos(u) - A(u, v) * sin(u),
        Au(u, v) * sin(u) + A(u, v) * cos(u),
        (v / 2) * cos(u / 2),
      ],
      sv: (u: number): Vec3 => [cos(u / 2) * cos(u), cos(u / 2) * sin(u), sin(u / 2)],
      suu: (u: number, v: number): Vec3 => [
        Auu(u, v) * cos(u) - 2 * Au(u, v) * sin(u) - A(u, v) * cos(u),
        Auu(u, v) * sin(u) + 2 * Au(u, v) * cos(u) - A(u, v) * sin(u),
        (-v / 4) * sin(u / 2),
      ],
      suv: (u: number): Vec3 => [
        -(sin(u / 2) / 2) * cos(u) - cos(u / 2) * sin(u),
        -(sin(u / 2) / 2) * sin(u) + cos(u / 2) * cos(u),
        cos(u / 2) / 2,
      ],
      svv: zero,
    };
  })(),
  roll: rolledStrip(0),
  'cone-roll': rolledSector(0),
};

/** The same surface with the parameters swapped, σ̃(s, t) = σ(t, s): same image, opposite normal. */
export function swapped(s: SurfaceDef): SurfaceDef {
  return {
    ...s,
    id: `${s.id}~swap`,
    names: [s.names[1], s.names[0]],
    u0: s.v0, u1: s.v1, v0: s.u0, v1: s.u1,
    p: (a, b) => s.p(b, a),
    su: (a, b) => s.sv(b, a),
    sv: (a, b) => s.su(b, a),
    suu: (a, b) => s.svv(b, a),
    suv: (a, b) => s.suv(b, a),
    svv: (a, b) => s.suu(b, a),
    family: s.family ? (l) => swapped(s.family!(l)) : undefined,
  };
}

/** σ_u × σ_v */
export const crossUV = (s: SurfaceDef, u: number, v: number): Vec3 => cross3(s.su(u, v), s.sv(u, v));

/** ‖σ_u × σ_v‖: zero exactly where σ is not regular. */
export const regularity = (s: SurfaceDef, u: number, v: number): number => len3(crossUV(s, u, v));

/** N̂ = σ_u × σ_v / ‖σ_u × σ_v‖, or null at a non-regular point. */
export function unitNormal3(s: SurfaceDef, u: number, v: number): Vec3 | null {
  const c = crossUV(s, u, v);
  const l = len3(c);
  return l < 1e-12 ? null : scale3(c, 1 / l);
}

/** The coefficients E, F, G of the first fundamental form. */
export function efg(s: SurfaceDef, u: number, v: number): { E: number; F: number; G: number } {
  const a = s.su(u, v);
  const b = s.sv(u, v);
  return { E: dot3(a, a), F: dot3(a, b), G: dot3(b, b) };
}

/** Q₁(a, b) = Ea² + 2Fab + Gb² = ‖aσ_u + bσ_v‖². */
export function q1(s: SurfaceDef, u: number, v: number, a: number, b: number): number {
  const { E, F, G } = efg(s, u, v);
  return E * a * a + 2 * F * a * b + G * b * b;
}

/** cos of the angle between the tangent vectors a₁σ_u + b₁σ_v and a₂σ_u + b₂σ_v, from E, F, G alone. */
export function cosAngle(s: SurfaceDef, u: number, v: number, a1: number, b1: number, a2: number, b2: number): number {
  const { E, F, G } = efg(s, u, v);
  const ip = E * a1 * a2 + F * (a1 * b2 + a2 * b1) + G * b1 * b2;
  return ip / sqrt(q1(s, u, v, a1, b1) * q1(s, u, v, a2, b2));
}

/** cos θ of the angle between the parameter curves: F/√(EG). */
export function paramAngleCos(s: SurfaceDef, u: number, v: number): number {
  const { E, F, G } = efg(s, u, v);
  return F / sqrt(E * G);
}

/** Length of t ↦ σ(c(t)) on [a, b] from the first form: ∫ √(E u′² + 2F u′v′ + G v′²) dt. */
export function lengthOnSurface(s: SurfaceDef, c: DomainCurve, a = c.t0, b = c.t1, n = 2000): number {
  if (b === a) return 0;
  return simpson((t) => {
    const [u, v] = c.c(t);
    const [du, dv] = c.dc(t);
    return sqrt(Math.max(0, q1(s, u, v, du, dv)));
  }, a, b, n);
}

/** The "length" of the curve in the parameter plane, ∫ √(u′² + v′²) dt: what the first form corrects. */
export function lengthInDomain(c: DomainCurve, a = c.t0, b = c.t1, n = 2000): number {
  if (b === a) return 0;
  return simpson((t) => Math.hypot(...c.dc(t)), a, b, n);
}

/** Length of the inscribed polygon of t ↦ σ(c(t)) with m chords: a check of lengthOnSurface that never uses E, F, G. */
export function polygonLengthOnSurface(s: SurfaceDef, c: DomainCurve, m = 4000, a = c.t0, b = c.t1): number {
  let L = 0;
  let prev = s.p(...c.c(a));
  for (let j = 1; j <= m; j++) {
    const q = s.p(...c.c(a + ((b - a) * j) / m));
    L += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]);
    prev = q;
  }
  return L;
}

const line = (id: string, label: string, formula: string, t0: number, t1: number, p0: [number, number], d: [number, number]): DomainCurve => ({
  id, label, formula, t0, t1, c: (t) => [p0[0] + d[0] * t, p0[1] + d[1] * t], dc: () => d,
});

/** Curves in each surface's domain that the lessons and the banks use. */
export const DOMAIN_CURVES: Record<string, DomainCurve[]> = {
  sphere: [
    line('latitude', 'קו רוחב v = π/3', 'u = t, v = π/3', 0, 2 * PI, [0, PI / 3], [1, 0]),
    line('meridian', 'קו אורך u = 0', 'u = 0, v = t', -PI / 2, PI / 2, [0, 0], [0, 1]),
    line('diagonal', 'u = t, v = t', 'u = t, v = t', 0, 1.2, [0, 0], [1, 1]),
  ],
  'sphere-colat': [
    line('cap-circle', 'קו רוחב u = π/6', 'u = π/6, v = t', 0, 2 * PI, [PI / 6, 0], [0, 1]),
    line('meridian', 'קו אורך v = 0', 'u = t, v = 0', 0, PI, [0, 0], [1, 0]),
  ],
  cylinder: [
    line('helix', 'סליל u = t, v = t/4', 'u = t, v = t/4', 0, 2 * PI, [0, -0.8], [1, 0.25]),
  ],
  cone: [
    {
      id: 'exp', label: 'u = t, v = eᵗ/3', formula: 'u = t, v = eᵗ/3', t0: 0, t1: 1,
      c: (t) => [t, Math.exp(t) / 3], dc: (t) => [1, Math.exp(t) / 3],
    },
  ],
  torus: [
    line('outer', 'קו המשווה החיצוני v = 0', 'u = t, v = 0', 0, 2 * PI, [0, 0], [1, 0]),
    line('inner', 'קו המשווה הפנימי v = π', 'u = t, v = π', 0, 2 * PI, [0, PI], [1, 0]),
  ],
  'plane-oblique': [line('diag', 'u = t, v = t', 'u = t, v = t', 0, 1, [0, 0], [1, 1])],
  saddle: [line('diag', 'x = t, y = t', 'x = t, y = t', -1, 1, [0, 0], [1, 1])],
  roll: [line('slant', 'הישר y = 3/4 + x/4', 'x = t, y = 3/4 + t/4', -PI, PI, [0, 0.75], [1, 0.25])],
  /** the segment x = 0.9, −1.1 ≤ y ≤ 1.1 of the flat sector, in polar coordinates: a straight line before rolling */
  'cone-roll': [
    {
      id: 'chord', label: 'קטע ישר בגזרה', formula: 'r = √(0.81 + t²), φ = arctan(t/0.9)', t0: -1.1, t1: 1.1,
      c: (t) => [Math.hypot(0.9, t), Math.atan2(t, 0.9)],
      dc: (t) => [t / Math.hypot(0.9, t), 0.9 / (0.81 + t * t)],
    },
  ],
};
