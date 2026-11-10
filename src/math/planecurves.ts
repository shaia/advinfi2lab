/**
 * Plane curves of chapter 1 with exact derivatives: the test objects the figures PlaneCurve and CurveFromCurvature
 * draw, and the quantities lessons 1.1–1.6 compute on them (velocity, speed, arc length, inscribed polygons,
 * signed and unsigned curvature, principal normal, osculating centre, tangent angle).
 *
 * MODEL SPECIFICATION
 * - System: a plane curve γ(t) = (x(t), y(t)) on a closed parameter interval [a, b], given with its first and
 *   second derivatives in closed form (no finite differences: the cusp (t², t³) has γ′(0) = 0 and a stencil
 *   would smear it).
 * - Quantities (course conventions, CLAUDE.md): speed ‖γ′‖; unit tangent t = γ′/‖γ′‖; the rotated normal
 *   n_s = t turned by +90°; signed curvature k = (x′y″ − y′x″)/‖γ′‖³, positive when the curve turns left;
 *   curvature κ = |k|; principal normal n = sign(k)·n_s where k ≠ 0; osculating centre γ + n_s/k; tangent angle θ
 *   a continuous lift of arg γ′ along the parameter, so θ′(t) = k‖γ′‖ and dθ/ds = k.
 * - Integrals: arc length ∫‖γ′‖ by composite Simpson; the inscribed polygon on a uniform partition of [a, b].
 * - Reversal: γ̃(t) = γ(a + b − t) has the same image, the opposite tangent and the opposite signed curvature.
 * - Ignored: points where γ′ = 0 (the tangent, k and θ are undefined there; the functions return NaN for k and the
 *   lift does not cross them meaningfully).
 * - Valid when: the preset's interval; Simpson with n = 2000 gives ~1e-12 relative error on these smooth speeds;
 *   the cycloid's speed 2|sin(t/2)| is smooth on [0, 2π].
 * - Failure modes: θ through a non-regular point (the cusp) jumps by π; callers use θ on regular presets only.
 *
 * A probe is evidence, never proof: lessons prove the identities, and these numbers recompute keys and drive figures.
 */

import { simpson } from './multivar';

export type P2 = [number, number];

export interface PlaneCurve {
  id: string;
  /** Hebrew name for a control */
  label: string;
  /** the formula as plain LTR text (figure readouts and aria labels), e.g. "(t², t³)" */
  formula: string;
  a: number;
  b: number;
  p: (t: number) => P2;
  d1: (t: number) => P2;
  d2: (t: number) => P2;
  /** true when γ′ ≠ 0 on the whole interval */
  regular: boolean;
}

const { cos, sin, exp, PI } = Math;

/** The chapter's plane curves. Each formula is exact; the lessons quote the same ones. */
export const PLANE_CURVES: Record<string, PlaneCurve> = {
  circle: {
    id: 'circle', label: 'מעגל', formula: '(cos t, sin t)', a: 0, b: 2 * PI, regular: true,
    p: (t) => [cos(t), sin(t)], d1: (t) => [-sin(t), cos(t)], d2: (t) => [-cos(t), -sin(t)],
  },
  'circle-fast': {
    id: 'circle-fast', label: 'מעגל, פעמיים', formula: '(cos 2t, sin 2t)', a: 0, b: 2 * PI, regular: true,
    p: (t) => [cos(2 * t), sin(2 * t)], d1: (t) => [-2 * sin(2 * t), 2 * cos(2 * t)], d2: (t) => [-4 * cos(2 * t), -4 * sin(2 * t)],
  },
  'circle-cw': {
    id: 'circle-cw', label: 'מעגל, עם כיוון השעון', formula: '(cos t, −sin t)', a: 0, b: 2 * PI, regular: true,
    p: (t) => [cos(t), -sin(t)], d1: (t) => [-sin(t), -cos(t)], d2: (t) => [-cos(t), sin(t)],
  },
  ellipse: {
    id: 'ellipse', label: 'אליפסה', formula: '(2 cos t, sin t)', a: 0, b: 2 * PI, regular: true,
    p: (t) => [2 * cos(t), sin(t)], d1: (t) => [-2 * sin(t), cos(t)], d2: (t) => [-2 * cos(t), -sin(t)],
  },
  parabola: {
    id: 'parabola', label: 'פרבולה', formula: '(t, t²)', a: -1.5, b: 1.5, regular: true,
    p: (t) => [t, t * t], d1: (t) => [1, 2 * t], d2: () => [0, 2],
  },
  cusp: {
    id: 'cusp', label: 'מסילה עם חוד', formula: '(t², t³)', a: -1.2, b: 1.2, regular: false,
    p: (t) => [t * t, t ** 3], d1: (t) => [2 * t, 3 * t * t], d2: (t) => [2, 6 * t],
  },
  cubic: {
    id: 'cubic', label: 'הגרף של x³', formula: '(t, t³)', a: -1.3, b: 1.3, regular: true,
    p: (t) => [t, t ** 3], d1: (t) => [1, 3 * t * t], d2: (t) => [0, 6 * t],
  },
  exp: {
    id: 'exp', label: 'הגרף של eˣ', formula: '(t, eᵗ)', a: -2.5, b: 1.2, regular: true,
    p: (t) => [t, exp(t)], d1: (t) => [1, exp(t)], d2: (t) => [0, exp(t)],
  },
  cycloid: {
    id: 'cycloid', label: 'ציקלואידה', formula: '(t − sin t, 1 − cos t)', a: 0, b: 2 * PI, regular: false,
    p: (t) => [t - sin(t), 1 - cos(t)], d1: (t) => [1 - cos(t), sin(t)], d2: (t) => [sin(t), cos(t)],
  },
  eight: {
    id: 'eight', label: 'שמינייה', formula: '(sin t, sin t cos t)', a: 0, b: 2 * PI, regular: true,
    p: (t) => [sin(t), sin(t) * cos(t)], d1: (t) => [cos(t), cos(2 * t)], d2: (t) => [-sin(t), -2 * sin(2 * t)],
  },
  logspiral: {
    id: 'logspiral', label: 'ספירלה לוגריתמית', formula: '(e^(−t/5) cos t, e^(−t/5) sin t)', a: 0, b: 4 * PI, regular: true,
    p: (t) => [exp(-t / 5) * cos(t), exp(-t / 5) * sin(t)],
    d1: (t) => [exp(-t / 5) * (-cos(t) / 5 - sin(t)), exp(-t / 5) * (-sin(t) / 5 + cos(t))],
    d2: (t) => [exp(-t / 5) * ((2 / 5) * sin(t) - (24 / 25) * cos(t)), exp(-t / 5) * (-(2 / 5) * cos(t) - (24 / 25) * sin(t))],
  },
  'slow-line': {
    id: 'slow-line', label: 'ישר עם עצירה', formula: '(t³, t³)', a: -1.2, b: 1.2, regular: false,
    p: (t) => [t ** 3, t ** 3], d1: (t) => [3 * t * t, 3 * t * t], d2: (t) => [6 * t, 6 * t],
  },
  loop: {
    id: 'loop', label: 'לולאה', formula: '(t³ − t, t²)', a: -1.5, b: 1.5, regular: true,
    p: (t) => [t ** 3 - t, t * t], d1: (t) => [3 * t * t - 1, 2 * t], d2: (t) => [6 * t, 2],
  },
};

/** γ̃(t) = γ(a + b − t): same image, opposite direction. */
export function reversed(c: PlaneCurve): PlaneCurve {
  const m = c.a + c.b;
  return {
    ...c,
    id: `${c.id}-rev`,
    p: (t) => c.p(m - t),
    d1: (t) => { const [x, y] = c.d1(m - t); return [-x, -y]; },
    d2: (t) => c.d2(m - t),
  };
}

export const speed = (c: PlaneCurve, t: number): number => Math.hypot(...c.d1(t));

/** Unit tangent t = γ′/‖γ′‖ (NaN where γ′ = 0). */
export function unitTangent(c: PlaneCurve, t: number): P2 {
  const [x, y] = c.d1(t);
  const v = Math.hypot(x, y);
  return v === 0 ? [NaN, NaN] : [x / v, y / v];
}

/** The rotated normal n_s: the unit tangent turned by +90° (to the left of the direction of motion). */
export function rotatedNormal(c: PlaneCurve, t: number): P2 {
  const [x, y] = unitTangent(c, t);
  return [-y, x];
}

/** Signed curvature k = (x′y″ − y′x″)/‖γ′‖³; positive when turning left. NaN where γ′ = 0. */
export function signedK(c: PlaneCurve, t: number): number {
  const [x1, y1] = c.d1(t);
  const [x2, y2] = c.d2(t);
  const v = Math.hypot(x1, y1);
  return v === 0 ? NaN : (x1 * y2 - y1 * x2) / v ** 3;
}

/** Curvature κ = |k| = ‖γ′ × γ″‖/‖γ′‖³. */
export const kappa = (c: PlaneCurve, t: number): number => Math.abs(signedK(c, t));

/** Principal normal n = sign(k)·n_s, defined where k ≠ 0 (null at an inflection). */
export function principalNormal(c: PlaneCurve, t: number): P2 | null {
  const k = signedK(c, t);
  if (!Number.isFinite(k) || k === 0) return null;
  const [nx, ny] = rotatedNormal(c, t);
  return [Math.sign(k) * nx, Math.sign(k) * ny];
}

/** Centre of the osculating circle γ + n_s/k (null where k = 0 or undefined). */
export function osculatingCentre2(c: PlaneCurve, t: number): P2 | null {
  const k = signedK(c, t);
  if (!Number.isFinite(k) || k === 0) return null;
  const [x, y] = c.p(t);
  const [nx, ny] = rotatedNormal(c, t);
  return [x + nx / k, y + ny / k];
}

/** Length of γ on [t0, t1] (t0 < t1): ∫‖γ′‖. */
export const arcLength2 = (c: PlaneCurve, t0: number, t1: number, n = 2000): number => simpson((t) => speed(c, t), t0, t1, n);

/** Length of the polygon inscribed at the n + 1 points of the uniform partition of [t0, t1]. */
export function polygonLength(c: PlaneCurve, nSeg: number, t0 = c.a, t1 = c.b): number {
  let L = 0;
  let prev = c.p(t0);
  for (let i = 1; i <= nSeg; i++) {
    const q = c.p(t0 + ((t1 - t0) * i) / nSeg);
    L += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
    prev = q;
  }
  return L;
}

/**
 * A continuous tangent angle θ(t) with θ(a) = atan2 γ′(a): arg γ′ unwrapped along the parameter in steps of at
 * most `step`. Meaningful on regular curves only.
 */
export function tangentAngle(c: PlaneCurve, t: number, step = 0.005): number {
  const ang = (s: number) => { const [x, y] = c.d1(s); return Math.atan2(y, x); };
  let th = ang(c.a);
  let prev = th;
  const n = Math.max(1, Math.ceil(Math.abs(t - c.a) / step));
  for (let i = 1; i <= n; i++) {
    const a = ang(c.a + ((t - c.a) * i) / n);
    let d = a - prev;
    while (d > PI) d -= 2 * PI;
    while (d < -PI) d += 2 * PI;
    th += d;
    prev = a;
  }
  return th;
}

/** Total signed curvature ∫k ds = ∫k(t)‖γ′(t)‖ dt over [t0, t1]; for a closed regular curve a multiple of 2π. */
export const totalSignedCurvature = (c: PlaneCurve, t0 = c.a, t1 = c.b, n = 4000): number =>
  simpson((t) => {
    const [x1, y1] = c.d1(t);
    const [x2, y2] = c.d2(t);
    return (x1 * y2 - y1 * x2) / (x1 * x1 + y1 * y1);
  }, t0, t1, n);

/* ------------------------------------------------- curves rebuilt from k(s) (lesson 1.6) */

export interface CurvatureLaw {
  id: string;
  label: string;
  /** k(s) as plain LTR text with the parameter c */
  formula: string;
  k: (s: number, c: number) => number;
  /** default parameter and slider range */
  c: number;
  cMin: number;
  cMax: number;
}

export const CURVATURE_LAWS: Record<string, CurvatureLaw> = {
  const: { id: 'const', label: 'קבועה', formula: 'k(s) = c', k: (_s, c) => c, c: 1, cMin: -2, cMax: 2 },
  linear: { id: 'linear', label: 'ספירלת קורנו', formula: 'k(s) = c·s', k: (s, c) => c * s, c: 1, cMin: -2, cMax: 2 },
  inverse: { id: 'inverse', label: 'ספירלה לוגריתמית', formula: 'k(s) = 1/(s + c)', k: (s, c) => 1 / (s + c), c: 1, cMin: 0.2, cMax: 3 },
  wave: { id: 'wave', label: 'גלית', formula: 'k(s) = c·sin s', k: (s, c) => c * sin(s), c: 1.5, cMin: -3, cMax: 3 },
};

/**
 * The plane curve with signed curvature k(s), 0 ≤ s ≤ len, starting at p0 with tangent angle θ0:
 * θ(s) = θ0 + ∫₀ˢ k, γ(s) = p0 + ∫₀ˢ (cos θ, sin θ). θ is integrated in closed form where the law allows, then
 * γ by composite Simpson on each sub-interval, so the samples are accurate to ~1e-10 for these laws.
 * Returns n + 1 samples {s, x, y, theta}.
 */
export function rebuildFromK(
  law: CurvatureLaw,
  c: number,
  len: number,
  opts: { n?: number; theta0?: number; p0?: P2 } = {},
): { s: number; x: number; y: number; theta: number }[] {
  const n = opts.n ?? 600;
  const th0 = opts.theta0 ?? 0;
  const [x0, y0] = opts.p0 ?? [0, 0];
  const theta = (s: number) => th0 + thetaIntegral(law, s, c);
  const out = [{ s: 0, x: x0, y: y0, theta: th0 }];
  let x = x0;
  let y = y0;
  for (let i = 1; i <= n; i++) {
    const s0 = (len * (i - 1)) / n;
    const s1 = (len * i) / n;
    x += simpson((s) => cos(theta(s)), s0, s1, 8);
    y += simpson((s) => sin(theta(s)), s0, s1, 8);
    out.push({ s: s1, x, y, theta: theta(s1) });
  }
  return out;
}

/** ∫₀ˢ k(u, c) du in closed form for the built-in laws (Simpson otherwise). */
export function thetaIntegral(law: CurvatureLaw, s: number, c: number): number {
  switch (law.id) {
    case 'const': return c * s;
    case 'linear': return (c * s * s) / 2;
    case 'inverse': return Math.log((s + c) / c);
    case 'wave': return c * (1 - cos(s));
    default: return simpson((u) => law.k(u, c), 0, s, 200);
  }
}
