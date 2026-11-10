/**
 * src/math/planecurves.ts, filed by accuracy category. Each test is named after the claim it checks.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import { d1, d2, signedCurvature } from '~/math/geometry';
import {
  CURVATURE_LAWS,
  PLANE_CURVES,
  arcLength2,
  kappa,
  osculatingCentre2,
  polygonLength,
  principalNormal,
  rebuildFromK,
  reversed,
  rotatedNormal,
  signedK,
  speed,
  tangentAngle,
  thetaIntegral,
  totalSignedCurvature,
  unitTangent,
} from '~/math/planecurves';

const PI = Math.PI;
const C = PLANE_CURVES;

describe('exact identities: the closed-form derivatives are the derivatives', () => {
  for (const c of Object.values(C)) {
    it(`${c.id}: γ′ and γ″ agree with the five-point stencils at interior points`, () => {
      const g = (t: number) => [...c.p(t), 0] as const;
      for (const f of [0.17, 0.43, 0.71, 0.88]) {
        const t = c.a + f * (c.b - c.a);
        const [x1, y1] = c.d1(t);
        const [x2, y2] = c.d2(t);
        const n1 = d1(g, t);
        const n2 = d2(g, t);
        expect(Math.hypot(x1 - n1[0], y1 - n1[1])).toBeLessThan(1e-8);
        expect(Math.hypot(x2 - n2[0], y2 - n2[1])).toBeLessThan(1e-5);
      }
    });
  }
  it('the signed curvature agrees with geometry.signedCurvature', () => {
    const c = C.ellipse;
    const g = (t: number) => [...c.p(t), 0] as const;
    for (const t of [0.3, 1.2, 2.9, 4.4]) expect(relativeError(signedK(c, t), signedCurvature(g, t))).toBeLessThan(1e-7);
  });
});

describe('analytic limits: curvature of the test objects', () => {
  it('the unit circle has k = 1, its osculating centre is the origin', () => {
    for (const t of [0, 1, 2.5]) {
      expect(relativeError(signedK(C.circle, t), 1)).toBeLessThan(1e-14);
      const o = osculatingCentre2(C.circle, t)!;
      expect(Math.hypot(...o)).toBeLessThan(1e-14);
    }
  });
  it('(cos 2t, sin 2t) has speed 2 but the same curvature 1: κ does not depend on the parametrization', () => {
    expect(speed(C['circle-fast'], 0.4)).toBeCloseTo(2, 14);
    expect(relativeError(kappa(C['circle-fast'], 0.4), 1)).toBeLessThan(1e-14);
  });
  it('the clockwise circle has k = −1 and the same κ = 1', () => {
    expect(relativeError(signedK(C['circle-cw'], 0.9), -1)).toBeLessThan(1e-14);
  });
  it('the ellipse (2cos t, sin t) has κ = 2 at (2,0) and κ = 1/4 at (0,1)', () => {
    expect(relativeError(kappa(C.ellipse, 0), 2)).toBeLessThan(1e-14);
    expect(relativeError(kappa(C.ellipse, PI / 2), 0.25)).toBeLessThan(1e-14);
  });
  it('the parabola (t, t²) has κ = 2 at the vertex and osculating centre (0, 1/2)', () => {
    expect(relativeError(kappa(C.parabola, 0), 2)).toBeLessThan(1e-14);
    const o = osculatingCentre2(C.parabola, 0)!;
    expect(Math.hypot(o[0], o[1] - 0.5)).toBeLessThan(1e-14);
  });
  it('the cubic (t, t³) has an inflection at 0: k = 0, no principal normal, no osculating circle', () => {
    expect(signedK(C.cubic, 0)).toBe(0);
    expect(principalNormal(C.cubic, 0)).toBeNull();
    expect(osculatingCentre2(C.cubic, 0)).toBeNull();
    expect(signedK(C.cubic, 0.5)).toBeGreaterThan(0);
    expect(signedK(C.cubic, -0.5)).toBeLessThan(0);
  });
  it('y = eˣ has maximal curvature 2/(3√3) at x = −ln 2 / 2', () => {
    const x0 = -Math.log(2) / 2;
    expect(relativeError(kappa(C.exp, x0), 2 / (3 * Math.sqrt(3)))).toBeLessThan(1e-14);
    for (const dx of [-0.05, 0.05]) expect(kappa(C.exp, x0 + dx)).toBeLessThan(kappa(C.exp, x0));
  });
  it('the cusp (t², t³) has γ′(0) = 0: no unit tangent, no curvature there', () => {
    expect(speed(C.cusp, 0)).toBe(0);
    expect(Number.isNaN(signedK(C.cusp, 0))).toBe(true);
    expect(Number.isNaN(unitTangent(C.cusp, 0)[0])).toBe(true);
  });
  it('at the cusp the unit tangent jumps from (−1, 0) to (1, 0); on (t³, t³) it is (1, 1)/√2 on both sides', () => {
    for (const [h, sx] of [[1e-4, 1], [-1e-4, -1]] as const) {
      const T = unitTangent(C.cusp, h);
      expect(Math.hypot(T[0] - sx, T[1])).toBeLessThan(1e-3);
      const S = unitTangent(C['slow-line'], h);
      expect(Math.hypot(S[0] - Math.SQRT1_2, S[1] - Math.SQRT1_2)).toBeLessThan(1e-14);
    }
    expect(speed(C['slow-line'], 0)).toBe(0);
  });
  it('the loop (t³ − t, t²) is regular, passes (0, 1) at t = ±1, with tangent vectors (2, −2) and (2, 2)', () => {
    const c = C.loop;
    for (let j = 0; j <= 600; j++) expect(speed(c, c.a + ((c.b - c.a) * j) / 600)).toBeGreaterThan(0.5);
    for (const t of [-1, 1]) {
      const p = c.p(t);
      expect(Math.hypot(p[0], p[1] - 1)).toBeLessThan(1e-15);
    }
    expect(c.d1(-1)).toEqual([2, -2]);
    expect(c.d1(1)).toEqual([2, 2]);
  });
  it('the principal normal is perpendicular to the tangent and points to the osculating centre', () => {
    for (const [c, t] of [[C.ellipse, 0.8], [C.exp, -1], [C.eight, 2]] as const) {
      const T = unitTangent(c, t);
      const n = principalNormal(c, t)!;
      expect(Math.abs(T[0] * n[0] + T[1] * n[1])).toBeLessThan(1e-14);
      const o = osculatingCentre2(c, t)!;
      const p = c.p(t);
      const to = [o[0] - p[0], o[1] - p[1]];
      expect(relativeError(to[0] * n[0] + to[1] * n[1], 1 / kappa(c, t))).toBeLessThan(1e-12);
    }
  });
});

describe('exact identities: orientation', () => {
  it('reversing the direction keeps κ and flips k and the tangent', () => {
    const c = C.ellipse;
    const r = reversed(c);
    const t = 1.1;
    const tr = c.a + c.b - t;
    expect(relativeError(signedK(r, tr), -signedK(c, t))).toBeLessThan(1e-14);
    expect(relativeError(kappa(r, tr), kappa(c, t))).toBeLessThan(1e-14);
    const [a, b] = [unitTangent(c, t), unitTangent(r, tr)];
    expect(Math.hypot(a[0] + b[0], a[1] + b[1])).toBeLessThan(1e-14);
    const [n1, n2] = [rotatedNormal(c, t), rotatedNormal(r, tr)];
    expect(Math.hypot(n1[0] + n2[0], n1[1] + n2[1])).toBeLessThan(1e-14);
  });
});

describe('convergence: arc length', () => {
  it('one arch of the cycloid has length 8', () => {
    expect(relativeError(arcLength2(C.cycloid, 0, 2 * PI), 8)).toBeLessThan(1e-10);
  });
  it('the unit circle has length 2π, and (cos 2t, sin 2t) on [0, 2π] has length 4π (it runs twice)', () => {
    expect(relativeError(arcLength2(C.circle, 0, 2 * PI), 2 * PI)).toBeLessThan(1e-12);
    expect(relativeError(arcLength2(C['circle-fast'], 0, 2 * PI), 4 * PI)).toBeLessThan(1e-12);
  });
  it('the logarithmic spiral e^(−t/5)(cos t, sin t) on [0, T] has length √(1+1/25)·5(1 − e^(−T/5))', () => {
    const T = 4 * PI;
    expect(relativeError(arcLength2(C.logspiral, 0, T), Math.sqrt(1 + 1 / 25) * 5 * (1 - Math.exp(-T / 5)))).toBeLessThan(1e-11);
  });
  it('the parabola from t = 0 to 1 has length (2√5 + asinh 2)/4', () => {
    expect(relativeError(arcLength2(C.parabola, 0, 1), (2 * Math.sqrt(5) + Math.asinh(2)) / 4)).toBeLessThan(1e-12);
  });
  it('inscribed polygons increase under refinement and stay below the arc length (the supremum)', () => {
    const L = arcLength2(C.cycloid, 0, 2 * PI);
    let prev = 0;
    for (const n of [2, 4, 8, 16, 32, 64, 128]) {
      const p = polygonLength(C.cycloid, n);
      expect(p).toBeGreaterThan(prev);
      expect(p).toBeLessThanOrEqual(L + 1e-12);
      prev = p;
    }
    expect(relativeError(polygonLength(C.cycloid, 4096), L)).toBeLessThan(1e-6);
  });
});

describe('exact identities: the tangent angle and total curvature', () => {
  it('dθ/ds = k: θ(t₁) − θ(t₀) equals ∫k ds', () => {
    for (const c of [C.ellipse, C.exp, C.eight, C.logspiral]) {
      const t1 = c.a + 0.77 * (c.b - c.a);
      expect(Math.abs(tangentAngle(c, t1) - tangentAngle(c, c.a) - totalSignedCurvature(c, c.a, t1))).toBeLessThan(1e-9);
    }
  });
  it('a simple closed curve turned counter-clockwise has total curvature 2π; the figure eight has 0', () => {
    expect(relativeError(totalSignedCurvature(C.circle), 2 * PI)).toBeLessThan(1e-12);
    expect(relativeError(totalSignedCurvature(C.ellipse), 2 * PI)).toBeLessThan(1e-10);
    expect(relativeError(totalSignedCurvature(C['circle-cw']), -2 * PI)).toBeLessThan(1e-12);
    expect(Math.abs(totalSignedCurvature(C.eight))).toBeLessThan(1e-10);
  });
});

describe('reconstruction from curvature', () => {
  it('k ≡ c gives the circle of radius 1/|c|, closed after length 2π/|c|', () => {
    const c = 2;
    const pts = rebuildFromK(CURVATURE_LAWS.const, c, (2 * PI) / c, { n: 400 });
    const end = pts[pts.length - 1];
    expect(Math.hypot(end.x, end.y)).toBeLessThan(1e-10);
    // every point at distance 1/c from the centre (0, 1/c)
    for (const q of pts) expect(Math.abs(Math.hypot(q.x, q.y - 1 / c) - 1 / c)).toBeLessThan(1e-10);
  });
  it('k(s) = 1/(s + c) gives the logarithmic spiral: the tangent angle is ln((s + c)/c)', () => {
    expect(relativeError(thetaIntegral(CURVATURE_LAWS.inverse, 3, 1), Math.log(4))).toBeLessThan(1e-15);
    // closed form: γ(s) = ((u/2)(cos ln u + sin ln u), (u/2)(sin ln u − cos ln u)) − value at u = c, for c = 1, θ0 = 0
    const pts = rebuildFromK(CURVATURE_LAWS.inverse, 1, 5, { n: 500 });
    const F = (u: number): [number, number] => [(u / 2) * (Math.cos(Math.log(u)) + Math.sin(Math.log(u))), (u / 2) * (Math.sin(Math.log(u)) - Math.cos(Math.log(u)))];
    const end = pts[pts.length - 1];
    const [ex, ey] = [F(6)[0] - F(1)[0], F(6)[1] - F(1)[1]];
    expect(Math.hypot(end.x - ex, end.y - ey)).toBeLessThan(1e-9);
  });
  it('changing θ₀ rotates the curve and changing p₀ translates it: the same shape', () => {
    const law = CURVATURE_LAWS.wave;
    const a = rebuildFromK(law, 1.5, 6, { n: 300 });
    const b = rebuildFromK(law, 1.5, 6, { n: 300, theta0: 0.7, p0: [1, -2] });
    const [co, si] = [Math.cos(0.7), Math.sin(0.7)];
    for (let i = 0; i < a.length; i += 37) {
      const rx = 1 + co * a[i].x - si * a[i].y;
      const ry = -2 + si * a[i].x + co * a[i].y;
      expect(Math.hypot(b[i].x - rx, b[i].y - ry)).toBeLessThan(1e-12);
    }
  });
  it('k ↦ −k reflects the curve in the line of the initial tangent', () => {
    const law = CURVATURE_LAWS.linear;
    const a = rebuildFromK(law, 1, 4, { n: 300 });
    const b = rebuildFromK(law, -1, 4, { n: 300 });
    for (let i = 0; i < a.length; i += 31) {
      expect(Math.abs(a[i].x - b[i].x)).toBeLessThan(1e-12);
      expect(Math.abs(a[i].y + b[i].y)).toBeLessThan(1e-12);
    }
  });
  it('the Cornu spiral k = s stays bounded: its points converge to (√π/2, √π/2)', () => {
    const pts = rebuildFromK(CURVATURE_LAWS.linear, 1, 30, { n: 6000 });
    const end = pts[pts.length - 1];
    expect(Math.hypot(end.x - Math.sqrt(PI) / 2, end.y - Math.sqrt(PI) / 2)).toBeLessThan(0.05);
  });
});
