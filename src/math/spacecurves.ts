/**
 * Space curves of chapter 2 with exact derivatives: the test objects the figures FrenetFrame and SpaceFromCurvature
 * draw, and the quantities lessons 2.1–2.5 compute on them (the Frenet frame, the osculating, normal and rectifying
 * planes, curvature, torsion, the Darboux vector, the osculating sphere, the curve rebuilt from κ(s) and τ(s)).
 *
 * MODEL SPECIFICATION
 * - System: a space curve γ: [a, b] → ℝ³ given with γ′, γ″, γ‴ in closed form (no finite differences: the glued
 *   curve is only C³ at t = 0, and a stencil across the seam would smear the jump of the frame that the lesson shows).
 * - Quantities (course conventions, CLAUDE.md): t = γ′/‖γ′‖; κ = ‖γ′ × γ″‖/‖γ′‖³; where κ > 0, b = (γ′ × γ″)/‖γ′ × γ″‖
 *   and n = b × t (so b = t × n, the frame is right-handed); torsion with the course's sign b′ = −τn:
 *   τ = (γ′ × γ″)·γ‴ / ‖γ′ × γ″‖², so the right-handed helix (a cos t, a sin t, bt), b > 0, has τ = b/(a² + b²) > 0.
 *   Darboux vector ω = τt + κb (t′ = ω × t, n′ = ω × n, b′ = ω × b in arc length). Osculating sphere centre
 *   γ + ρn + (ρ′/τ)b with ρ = 1/κ and ρ′ = dρ/ds, radius² = ρ² + (ρ′/τ)².
 * - Transformations: reversal γ̃(t) = γ(a + b − t) (t and b change sign, n, κ and τ do not); the mirror image
 *   (x, y, z) ↦ (x, y, −z) (κ is kept, τ changes sign).
 * - Dynamics: rebuildFromKT integrates the Frenet–Serret system t′ = κn, n′ = −κt + τb, b′ = −τn, γ′ = t in the arc
 *   length by classical RK4 (geometry.ts rk4System), from a starting point and a starting frame.
 * - Ignored: points where κ = 0 (frame() returns null there; τ is reported as NaN); arc-length derivatives of κ are
 *   taken by a symmetric difference quotient in t divided by the speed (ρ′ only, for the osculating sphere probe).
 * - Valid when: the preset's interval; Simpson with n = 2000 gives ~1e-12 relative error on these speeds; RK4 with
 *   n = 2000 steps on length ≤ 20 and |κ|, |τ| ≤ 3 keeps the frame orthonormal to ~1e-10.
 * - Failure modes: near κ = 0 the frame and τ are ill-conditioned (the glued curve at t = 0, the saddle curve never);
 *   the osculating sphere needs τ ≠ 0 (it is not defined on a plane curve).
 *
 * A probe is evidence, never proof: lessons prove the identities, and these numbers recompute keys and drive figures.
 */

import { rk4System } from './geometry';
import { simpson } from './multivar';
import { add3, cross3, dot3, len3, scale3, sub3, type Vec3 } from './vec';

export interface SpaceCurve {
  id: string;
  /** Hebrew name for a control */
  label: string;
  /** the formula as plain LTR text (figure readouts and aria labels) */
  formula: string;
  a: number;
  b: number;
  p: (t: number) => Vec3;
  d1: (t: number) => Vec3;
  d2: (t: number) => Vec3;
  d3: (t: number) => Vec3;
  /** a point and a unit direction of an axis the lesson refers to (helix axis, Lancret axis), if any */
  axis?: { point: Vec3; dir: Vec3 };
  /** centre and radius of a sphere the curve lies on (lesson 2.5), if any */
  sphere?: { centre: Vec3; radius: number };
  /** a normal vector and a point of the plane the curve lies in, if it is planar */
  plane?: { point: Vec3; normal: Vec3 };
}

const { cos, sin, PI, sqrt } = Math;
const SQ3 = sqrt(3);

/** helix (a cos t, a sin t, c t); c > 0 right-handed */
function helix(id: string, label: string, formula: string, a: number, c: number, w = 1): SpaceCurve {
  return {
    id, label, formula, a: -2 * PI / w, b: 2 * PI / w,
    p: (t) => [a * cos(w * t), a * sin(w * t), c * t],
    d1: (t) => [-a * w * sin(w * t), a * w * cos(w * t), c],
    d2: (t) => [-a * w * w * cos(w * t), -a * w * w * sin(w * t), 0],
    d3: (t) => [a * w ** 3 * sin(w * t), -a * w ** 3 * cos(w * t), 0],
    axis: { point: [0, 0, 0], dir: [0, 0, 1] },
  };
}

/** The chapter's space curves. Each formula is exact; the lessons quote the same ones. */
export const SPACE_CURVES: Record<string, SpaceCurve> = {
  helix: helix('helix', 'סליל ימני', '(cos t, sin t, t/2)', 1, 0.5),
  'helix-left': helix('helix-left', 'סליל שמאלי', '(cos t, sin t, −t/2)', 1, -0.5),
  /** the same image as `helix`, run twice as fast: κ and τ at corresponding points agree */
  'helix-fast': helix('helix-fast', 'סליל ימני, מהיר פי 2', '(cos 2t, sin 2t, t)', 1, 1, 2),
  cubic: {
    id: 'cubic', label: 'המסילה המעוקבת', formula: '(t, t², t³)', a: -1.2, b: 1.2,
    p: (t) => [t, t * t, t ** 3], d1: (t) => [1, 2 * t, 3 * t * t], d2: (t) => [0, 2, 6 * t], d3: () => [0, 0, 6],
  },
  /**
   * C³ version of the bank's C^∞ glued curve (Q-2.1-glued): in the plane z = 0 for t ≤ 0, in the plane y = 0 for
   * t > 0. κ(0) = 0, κ > 0 elsewhere; b = (0, 0, 1) on the left, (0, −1, 0) on the right: the frame jumps.
   */
  glued: {
    id: 'glued', label: 'מסילה מודבקת', formula: '(t, t⁴, 0) ; (t, 0, t⁴)', a: -1.1, b: 1.1,
    p: (t) => (t <= 0 ? [t, t ** 4, 0] : [t, 0, t ** 4]),
    d1: (t) => (t <= 0 ? [1, 4 * t ** 3, 0] : [1, 0, 4 * t ** 3]),
    d2: (t) => (t <= 0 ? [0, 12 * t * t, 0] : [0, 0, 12 * t * t]),
    d3: (t) => (t <= 0 ? [0, 24 * t, 0] : [0, 0, 24 * t]),
  },
  /** (t, t³, 0): κ(0) = 0; n and b jump (n → ±e_y, b → ±e_z) but the osculating plane z = 0 extends (lesson 2.1.11) */
  'planar-cubic': {
    id: 'planar-cubic', label: 'הגרף של t³', formula: '(t, t³, 0)', a: -1.2, b: 1.2,
    p: (t) => [t, t ** 3, 0], d1: (t) => [1, 3 * t * t, 0], d2: (t) => [0, 6 * t, 0], d3: () => [0, 6, 0],
    plane: { point: [0, 0, 0], normal: [0, 0, 1] },
  },
  /** planar, in the plane z = x + y (not a coordinate plane), with non-constant curvature */
  planar: {
    id: 'planar', label: 'מסילה מישורית נטויה', formula: '(cos t, sin t, cos t + sin t)', a: 0, b: 2 * PI,
    p: (t) => [cos(t), sin(t), cos(t) + sin(t)],
    d1: (t) => [-sin(t), cos(t), cos(t) - sin(t)],
    d2: (t) => [-cos(t), -sin(t), -cos(t) - sin(t)],
    d3: (t) => [sin(t), -cos(t), sin(t) - cos(t)],
    plane: { point: [0, 0, 0], normal: [1 / SQ3, 1 / SQ3, -1 / SQ3] },
  },
  /** on the saddle z = x² − y²; its torsion changes sign */
  saddle: {
    id: 'saddle', label: 'מסילה על אוכף', formula: '(cos t, sin t, cos 2t)', a: 0, b: 2 * PI,
    p: (t) => [cos(t), sin(t), cos(2 * t)],
    d1: (t) => [-sin(t), cos(t), -2 * sin(2 * t)],
    d2: (t) => [-cos(t), -sin(t), -4 * cos(2 * t)],
    d3: (t) => [sin(t), -cos(t), 8 * sin(2 * t)],
  },
  /**
   * A generalized helix over the catenary: (t, cosh t, sinh t) lies on the cylinder over y = cosh x, its tangent
   * (1, sinh t, cosh t)/(√2 cosh t) makes the constant angle π/4 with the z axis, and κ = τ = 1/(2cosh²t).
   */
  'cylinder-helix': {
    id: 'cylinder-helix', label: 'סליל מוכלל מעל שרשרת', formula: '(t, cosh t, sinh t)', a: -2, b: 2,
    p: (t) => [t, Math.cosh(t), Math.sinh(t)],
    d1: (t) => [1, Math.sinh(t), Math.cosh(t)],
    d2: (t) => [0, Math.cosh(t), Math.sinh(t)],
    d3: (t) => [0, Math.sinh(t), Math.cosh(t)],
    axis: { point: [0, 1, 0], dir: [0, 0, 1] },
  },
  /** Viviani's curve: the sphere x² + y² + z² = 4 cut by the cylinder (x − 1)² + y² = 1 */
  viviani: {
    id: 'viviani', label: 'המסילה של ויויאני', formula: '(1 + cos t, sin t, 2 sin(t/2))', a: -2 * PI, b: 2 * PI,
    p: (t) => [1 + cos(t), sin(t), 2 * sin(t / 2)],
    d1: (t) => [-sin(t), cos(t), cos(t / 2)],
    d2: (t) => [-cos(t), -sin(t), -0.5 * sin(t / 2)],
    d3: (t) => [sin(t), -cos(t), -0.25 * cos(t / 2)],
    sphere: { centre: [0, 0, 0], radius: 2 },
  },
};

/** γ run backwards on the same interval: γ̃(t) = γ(a + b − t). */
export function reversed(c: SpaceCurve): SpaceCurve {
  const m = (t: number) => c.a + c.b - t;
  return {
    ...c,
    id: `${c.id}-reversed`,
    p: (t) => c.p(m(t)),
    d1: (t) => scale3(c.d1(m(t)), -1),
    d2: (t) => c.d2(m(t)),
    d3: (t) => scale3(c.d3(m(t)), -1),
  };
}

const flipZ = (v: Vec3): Vec3 => [v[0], v[1], -v[2]];

/** The mirror image of γ in the plane z = 0: (x, y, z) ↦ (x, y, −z), an orthogonal map with determinant −1. */
export function mirrored(c: SpaceCurve): SpaceCurve {
  return {
    ...c,
    id: `${c.id}-mirror`,
    p: (t) => flipZ(c.p(t)),
    d1: (t) => flipZ(c.d1(t)),
    d2: (t) => flipZ(c.d2(t)),
    d3: (t) => flipZ(c.d3(t)),
    axis: c.axis && { point: flipZ(c.axis.point), dir: flipZ(c.axis.dir) },
    sphere: c.sphere && { centre: flipZ(c.sphere.centre), radius: c.sphere.radius },
    plane: c.plane && { point: flipZ(c.plane.point), normal: flipZ(c.plane.normal) },
  };
}

const unit = (v: Vec3): Vec3 => scale3(v, 1 / len3(v));

export const speed = (c: SpaceCurve, t: number): number => len3(c.d1(t));
export const unitTangent = (c: SpaceCurve, t: number): Vec3 => unit(c.d1(t));

/** κ = ‖γ′ × γ″‖ / ‖γ′‖³ */
export function kappa(c: SpaceCurve, t: number): number {
  const v = c.d1(t);
  return len3(cross3(v, c.d2(t))) / len3(v) ** 3;
}

/** τ = (γ′ × γ″)·γ‴ / ‖γ′ × γ″‖² (course sign b′ = −τn); NaN where γ′ × γ″ = 0. */
export function tau(c: SpaceCurve, t: number): number {
  const w = cross3(c.d1(t), c.d2(t));
  const q = dot3(w, w);
  return q === 0 ? NaN : dot3(w, c.d3(t)) / q;
}

export interface Frame {
  t: Vec3;
  n: Vec3;
  b: Vec3;
}

/** The Frenet frame where κ > minKappa; null where the curvature (numerically) vanishes. */
export function frame(c: SpaceCurve, t: number, minKappa = 1e-9): Frame | null {
  const v = c.d1(t);
  const w = cross3(v, c.d2(t));
  if (len3(w) / len3(v) ** 3 <= minKappa) return null;
  const T = unit(v);
  const B = unit(w);
  return { t: T, n: cross3(B, T), b: B };
}

/** Darboux vector ω = τt + κb: the angular velocity of the frame per unit arc length. */
export function darboux(c: SpaceCurve, t: number): Vec3 | null {
  const f = frame(c, t);
  if (!f) return null;
  return add3(scale3(f.t, tau(c, t)), scale3(f.b, kappa(c, t)));
}

/** Centre of the osculating circle γ + n/κ. */
export function osculatingCentre(c: SpaceCurve, t: number): Vec3 | null {
  const f = frame(c, t);
  return f && add3(c.p(t), scale3(f.n, 1 / kappa(c, t)));
}

/** dρ/ds, ρ = 1/κ, by a symmetric difference quotient in t divided by the speed. */
export function rhoPrime(c: SpaceCurve, t: number, h = 1e-4): number {
  const r = (u: number) => 1 / kappa(c, u);
  return (r(t + h) - r(t - h)) / (2 * h) / speed(c, t);
}

/** Centre and radius of the osculating sphere γ + ρn + (ρ′/τ)b (needs κ > 0 and τ ≠ 0). */
export function osculatingSphere(c: SpaceCurve, t: number): { centre: Vec3; radius: number } | null {
  const f = frame(c, t);
  const w = tau(c, t);
  if (!f || !Number.isFinite(w) || Math.abs(w) < 1e-12) return null;
  const rho = 1 / kappa(c, t);
  const q = rhoPrime(c, t) / w;
  return { centre: add3(add3(c.p(t), scale3(f.n, rho)), scale3(f.b, q)), radius: Math.hypot(rho, q) };
}

/** Arc length from a to t: ∫‖γ′‖ by composite Simpson (negative when t < a). */
export function arcLength(c: SpaceCurve, a: number, t: number, n = 2000): number {
  return simpson((u) => speed(c, u), a, t, n);
}

/** Signed distance of γ(t + h) from the osculating plane at γ(t), i.e. (γ(t + h) − γ(t))·b(t). */
export function offOsculatingPlane(c: SpaceCurve, t: number, h: number): number {
  const f = frame(c, t);
  return f ? dot3(sub3(c.p(t + h), c.p(t)), f.b) : NaN;
}

/**
 * The local canonical form (Taylor in arc length to order 3, in the frame at s = 0):
 * γ(s) − γ(0) ≈ (s − κ²s³/6) t + (κs²/2 + κ′s³/6) n + (κτs³/6) b.
 */
export function canonicalForm(k: number, kp: number, w: number, s: number): Vec3 {
  return [s - (k * k * s ** 3) / 6, (k * s * s) / 2 + (kp * s ** 3) / 6, (k * w * s ** 3) / 6];
}

/** Radius and pitch parameter of the helix (a cos s/c, a sin s/c, b s/c), c = √(a² + b²), with curvature κ and torsion τ. */
export function helixFromKT(k: number, w: number): { a: number; b: number } {
  const q = k * k + w * w;
  return { a: k / q, b: w / q };
}

/* ---------------- the curve rebuilt from κ(s) and τ(s) (lesson 2.4) ---------------- */

export interface SpaceLaw {
  id: string;
  label: string;
  /** plain LTR text, e.g. "κ = c₁, τ = c₂" */
  formula: string;
  kappa: (s: number, c1: number, c2: number) => number;
  tau: (s: number, c1: number, c2: number) => number;
  c1: number;
  c2: number;
  c1Min: number;
  c1Max: number;
  c2Min: number;
  c2Max: number;
}

export const SPACE_LAWS: Record<string, SpaceLaw> = {
  const: {
    id: 'const', label: 'קבועים', formula: 'κ = c₁, τ = c₂',
    kappa: (_s, c1) => c1, tau: (_s, _c1, c2) => c2,
    c1: 0.8, c2: 0.4, c1Min: 0.1, c1Max: 2, c2Min: -1.5, c2Max: 1.5,
  },
  'tau-linear': {
    id: 'tau-linear', label: 'פיתול גדל', formula: 'κ = c₁, τ = c₂ s',
    kappa: (_s, c1) => c1, tau: (s, _c1, c2) => c2 * s,
    c1: 1, c2: 0.3, c1Min: 0.1, c1Max: 2, c2Min: -1, c2Max: 1,
  },
  wave: {
    id: 'wave', label: 'פיתול מתנודד', formula: 'κ = c₁, τ = c₂ sin s',
    kappa: (_s, c1) => c1, tau: (s, _c1, c2) => c2 * sin(s),
    c1: 1, c2: 1, c1Min: 0.1, c1Max: 2, c2Min: -2, c2Max: 2,
  },
  /** τ/κ = c₂/c₁ is constant: a generalized helix (Lancret, lesson 2.5) */
  lancret: {
    id: 'lancret', label: 'יחס קבוע', formula: 'κ = c₁(1 + s/4), τ = c₂(1 + s/4)',
    kappa: (s, c1) => c1 * (1 + s / 4), tau: (s, _c1, c2) => c2 * (1 + s / 4),
    c1: 1, c2: 0.5, c1Min: 0.1, c1Max: 2, c2Min: -1.5, c2Max: 1.5,
  },
};

export interface Rebuilt {
  pts: Vec3[];
  frames: Frame[];
  /** max over the samples of |FᵀF − I| entries: how far the integrated frame drifted from orthonormal */
  orthoDefect: number;
}

/** Rotation by angle φ about a unit axis u (Rodrigues). */
export function rotate(v: Vec3, u: Vec3, phi: number): Vec3 {
  const c = cos(phi);
  const s = sin(phi);
  return add3(add3(scale3(v, c), scale3(cross3(u, v), s)), scale3(u, dot3(u, v) * (1 - c)));
}

/**
 * The curve with curvature κ(s) > 0 and torsion τ(s) on [0, len], starting at p0 with the frame f0 (default the
 * standard basis). Returns n + 1 samples with their integrated frames.
 */
export function rebuildFromKT(
  k: (s: number) => number,
  w: (s: number) => number,
  len: number,
  opts: { n?: number; p0?: Vec3; frame0?: Frame } = {},
): Rebuilt {
  const n = opts.n ?? 2000;
  const p0 = opts.p0 ?? [0, 0, 0];
  const f0 = opts.frame0 ?? { t: [1, 0, 0], n: [0, 1, 0], b: [0, 0, 1] };
  const f = (s: number, y: number[]) => {
    const T = y.slice(3, 6);
    const N = y.slice(6, 9);
    const B = y.slice(9, 12);
    const ks = k(s);
    const ws = w(s);
    return [...T, ...N.map((x) => ks * x), ...T.map((x, i) => -ks * x + ws * B[i]), ...N.map((x) => -ws * x)];
  };
  const { y } = rk4System(f, 0, [...p0, ...f0.t, ...f0.n, ...f0.b], len, n);
  let orthoDefect = 0;
  const frames: Frame[] = [];
  const pts: Vec3[] = [];
  for (const r of y) {
    const T: Vec3 = [r[3], r[4], r[5]];
    const N: Vec3 = [r[6], r[7], r[8]];
    const B: Vec3 = [r[9], r[10], r[11]];
    const F = [T, N, B];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) orthoDefect = Math.max(orthoDefect, Math.abs(dot3(F[i], F[j]) - (i === j ? 1 : 0)));
    pts.push([r[0], r[1], r[2]]);
    frames.push({ t: T, n: N, b: B });
  }
  return { pts, frames, orthoDefect };
}

/** rebuildFromKT for a named law with parameters c₁, c₂. */
export function rebuildLaw(law: SpaceLaw, c1: number, c2: number, len: number, opts: { n?: number; p0?: Vec3; frame0?: Frame } = {}): Rebuilt {
  return rebuildFromKT((s) => law.kappa(s, c1, c2), (s) => law.tau(s, c1, c2), len, opts);
}
