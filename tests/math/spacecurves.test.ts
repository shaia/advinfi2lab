/**
 * src/math/spacecurves.ts, filed by accuracy category. Each test is named after the claim it checks.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import { d1, d2, d3, torsion as torsionFD } from '~/math/geometry';
import {
  SPACE_CURVES,
  SPACE_LAWS,
  arcLength,
  canonicalForm,
  darboux,
  frame,
  helixFromKT,
  kappa,
  mirrored,
  offOsculatingPlane,
  osculatingSphere,
  rebuildFromKT,
  rebuildLaw,
  reversed,
  rotate,
  speed,
  tau,
  unitTangent,
} from '~/math/spacecurves';
import { cross3, dot3, len3, scale3, sub3, type Vec3 } from '~/math/vec';

const C = SPACE_CURVES;
const dist = (a: Vec3, b: Vec3) => len3(sub3(a, b));

describe('exact identities: the closed-form derivatives are the derivatives', () => {
  for (const c of Object.values(C)) {
    it(`${c.id}: γ′, γ″, γ‴ agree with the stencils at interior points away from any seam`, () => {
      for (const f of [0.13, 0.31, 0.62, 0.87]) {
        const t = c.a + f * (c.b - c.a);
        expect(dist(c.d1(t), d1(c.p, t))).toBeLessThan(1e-7);
        expect(dist(c.d2(t), d2(c.p, t))).toBeLessThan(1e-6);
        expect(dist(c.d3(t), d3(c.p, t))).toBeLessThan(1e-4 * (1 + len3(c.d3(t))));
      }
    });
  }
});

describe('exact identities: the frame', () => {
  for (const c of Object.values(C)) {
    it(`${c.id}: {t, n, b} is orthonormal and right-handed (b = t × n) wherever κ > 0`, () => {
      for (const f of [0.1, 0.3, 0.55, 0.8, 0.95]) {
        const t = c.a + f * (c.b - c.a);
        const F = frame(c, t);
        if (!F) continue;
        const M = [F.t, F.n, F.b];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(Math.abs(dot3(M[i], M[j]) - (i === j ? 1 : 0))).toBeLessThan(1e-12);
        expect(dist(cross3(F.t, F.n), F.b)).toBeLessThan(1e-12);
      }
    });
  }

  it('Frenet–Serret: on the cubic, dt/ds = κn, dn/ds = −κt + τb, db/ds = −τn (difference quotients)', () => {
    const c = C.cubic;
    for (const t of [-0.7, 0, 0.4, 0.9]) {
      const h = 1e-5;
      const Fp = frame(c, t + h)!;
      const Fm = frame(c, t - h)!;
      const F = frame(c, t)!;
      const ds = 2 * h * speed(c, t);
      const k = kappa(c, t);
      const w = tau(c, t);
      const dT = scale3(sub3(Fp.t, Fm.t), 1 / ds);
      const dN = scale3(sub3(Fp.n, Fm.n), 1 / ds);
      const dB = scale3(sub3(Fp.b, Fm.b), 1 / ds);
      expect(dist(dT, scale3(F.n, k))).toBeLessThan(1e-6);
      expect(dist(dN, [-k * F.t[0] + w * F.b[0], -k * F.t[1] + w * F.b[1], -k * F.t[2] + w * F.b[2]])).toBeLessThan(1e-6);
      expect(dist(dB, scale3(F.n, -w))).toBeLessThan(1e-6);
    }
  });

  it('Darboux: t′ = ω × t, n′ = ω × n, b′ = ω × b with ω = τt + κb (algebraic identity on the helix)', () => {
    const c = C.helix;
    const t = 0.7;
    const F = frame(c, t)!;
    const w = darboux(c, t)!;
    const k = kappa(c, t);
    const tt = tau(c, t);
    expect(dist(cross3(w, F.t), scale3(F.n, k))).toBeLessThan(1e-12);
    expect(dist(cross3(w, F.b), scale3(F.n, -tt))).toBeLessThan(1e-12);
  });
});

describe('analytic values: helices, the cubic, the planar curve', () => {
  it('right-handed helix (cos t, sin t, t/2): κ = 1/1.25 = 0.8, τ = 0.5/1.25 = 0.4 everywhere', () => {
    for (const t of [-3, 0, 1.1, 5]) {
      expect(relativeError(kappa(C.helix, t), 0.8)).toBeLessThan(1e-12);
      expect(relativeError(tau(C.helix, t), 0.4)).toBeLessThan(1e-12);
    }
  });
  it('left-handed helix: κ = 0.8, τ = −0.4', () => {
    expect(relativeError(tau(C['helix-left'], 0.3), -0.4)).toBeLessThan(1e-12);
    expect(relativeError(kappa(C['helix-left'], 0.3), 0.8)).toBeLessThan(1e-12);
  });
  it('helix b points along +z tilted: b = (a sin t·(−c), …)/√(a²+c²), b·e_z = a/√(a²+c²) > 0', () => {
    const F = frame(C.helix, 0)!;
    expect(relativeError(F.b[2], 1 / Math.sqrt(1.25))).toBeLessThan(1e-12);
    expect(dist(F.n, [-1, 0, 0])).toBeLessThan(1e-12);
  });
  it('twisted cubic at 0: κ = 2, τ = 3; in general τ = 3/(1 + 9t² + 9t⁴)', () => {
    expect(relativeError(kappa(C.cubic, 0), 2)).toBeLessThan(1e-12);
    expect(relativeError(tau(C.cubic, 0), 3)).toBeLessThan(1e-12);
    for (const t of [-1, 0.5, 1.1]) expect(relativeError(tau(C.cubic, t), 3 / (1 + 9 * t * t + 9 * t ** 4))).toBeLessThan(1e-12);
  });
  it('the planar curve: τ ≡ 0 and b = ±(1, 1, −1)/√3, the normal of the plane z = x + y', () => {
    for (const t of [0.2, 1.7, 4]) {
      expect(Math.abs(tau(C.planar, t))).toBeLessThan(1e-14);
      expect(Math.abs(Math.abs(dot3(frame(C.planar, t)!.b, C.planar.plane!.normal)) - 1)).toBeLessThan(1e-12);
    }
    expect(relativeError(kappa(C.planar, 0), kappa(C.planar, Math.PI / 4))).toBeGreaterThan(0.1);
  });
  it('the finite-difference torsion of geometry.ts agrees with the exact one (cubic, saddle)', () => {
    for (const [c, t] of [[C.cubic, 0.4], [C.saddle, 1]] as const) expect(relativeError(torsionFD(c.p, t), tau(c, t))).toBeLessThan(1e-6);
  });
  it('the saddle curve has torsion of both signs', () => {
    const vals = [0.3, 1.2, 2, 2.8, 3.7, 4.6, 5.5].map((t) => tau(C.saddle, t));
    expect(Math.max(...vals)).toBeGreaterThan(0.05);
    expect(Math.min(...vals)).toBeLessThan(-0.05);
  });
  it('helixFromKT inverts κ = a/(a²+b²), τ = b/(a²+b²): κ = 0.8, τ = 0.4 gives a = 1, b = 0.5', () => {
    const h = helixFromKT(0.8, 0.4);
    expect(relativeError(h.a, 1)).toBeLessThan(1e-12);
    expect(relativeError(h.b, 0.5)).toBeLessThan(1e-12);
  });
});

describe('invariance: reparametrization, reversal and reflection', () => {
  it('κ and τ do not depend on the speed: helix-fast at t equals helix at 2t', () => {
    for (const t of [-1, 0.25, 1.4]) {
      expect(relativeError(kappa(C['helix-fast'], t), kappa(C.helix, 2 * t))).toBeLessThan(1e-12);
      expect(relativeError(tau(C['helix-fast'], t), tau(C.helix, 2 * t))).toBeLessThan(1e-12);
    }
  });
  it('reversal keeps κ, τ and n, and reverses t and b', () => {
    for (const c of [C.cubic, C.saddle, C.viviani]) {
      const r = reversed(c);
      const t = c.a + 0.37 * (c.b - c.a);
      const u = c.a + c.b - t;
      expect(relativeError(kappa(r, u), kappa(c, t))).toBeLessThan(1e-12);
      expect(relativeError(tau(r, u), tau(c, t))).toBeLessThan(1e-12);
      const F = frame(c, t)!;
      const G = frame(r, u)!;
      expect(dist(G.t, scale3(F.t, -1))).toBeLessThan(1e-12);
      expect(dist(G.n, F.n)).toBeLessThan(1e-12);
      expect(dist(G.b, scale3(F.b, -1))).toBeLessThan(1e-12);
    }
  });
  it('a reflection keeps κ and changes the sign of τ (the right-handed helix becomes left-handed)', () => {
    for (const c of [C.helix, C.cubic, C.saddle]) {
      const m = mirrored(c);
      const t = c.a + 0.41 * (c.b - c.a);
      expect(relativeError(kappa(m, t), kappa(c, t))).toBeLessThan(1e-12);
      expect(relativeError(tau(m, t), -tau(c, t))).toBeLessThan(1e-12);
    }
    expect(relativeError(tau(mirrored(C.helix), 0), tau(C['helix-left'], 0))).toBeLessThan(1e-12);
  });
});

describe('analytic limits: the osculating plane and the canonical form', () => {
  it('the distance from the osculating plane is (κτ/6)s³ + o(s³)', () => {
    const c = C.cubic;
    const t = 0;
    const k = kappa(c, t);
    const w = tau(c, t);
    for (const h of [1e-2, 5e-3, 2.5e-3]) {
      const s = arcLength(c, t, t + h, 200);
      expect(relativeError(offOsculatingPlane(c, t, h), (k * w * s ** 3) / 6)).toBeLessThan(40 * h);
    }
  });
  it('the canonical form matches the helix to O(s⁴) in the frame at the point', () => {
    const c = C.helix;
    const F = frame(c, 0)!;
    const k = kappa(c, 0);
    const w = tau(c, 0);
    const v = speed(c, 0);
    for (const s of [0.1, 0.05, 0.025]) {
      const d = sub3(c.p(s / v), c.p(0));
      const loc: Vec3 = [dot3(d, F.t), dot3(d, F.n), dot3(d, F.b)];
      const err = dist(loc, canonicalForm(k, 0, w, s));
      expect(err).toBeLessThan(0.2 * s ** 4);
    }
  });
  it('the glued curve: κ(0) = 0, and the frame jumps from b = (0,0,1) to b = (0,−1,0)', () => {
    const c = C.glued;
    expect(kappa(c, 0)).toBe(0);
    expect(frame(c, 0)).toBeNull();
    for (const h of [0.3, 0.01, 1e-3]) {
      expect(dist(frame(c, -h)!.b, [0, 0, 1])).toBeLessThan(1e-12);
      expect(dist(frame(c, h)!.b, [0, -1, 0])).toBeLessThan(1e-12);
    }
  });
});

describe('exact identities: Lancret and the sphere (lesson 2.5)', () => {
  it('generalized helix over the catenary: t·e_z = 1/√2 constant, and κ = τ = 1/(2cosh²t), so τ/κ = 1 = cot(π/4)', () => {
    const c = C['cylinder-helix'];
    for (const t of [-1.7, -0.4, 0, 0.9, 1.6]) {
      expect(relativeError(unitTangent(c, t)[2], 1 / Math.sqrt(2))).toBeLessThan(1e-12);
      expect(relativeError(kappa(c, t), 1 / (2 * Math.cosh(t) ** 2))).toBeLessThan(1e-12);
      expect(relativeError(tau(c, t), 1 / (2 * Math.cosh(t) ** 2))).toBeLessThan(1e-12);
    }
  });
  it('Viviani: every point is at distance 2 from the origin, and the osculating sphere is that sphere', () => {
    const c = C.viviani;
    for (const t of [-5, -2, 0.7, 2.2, 4]) {
      expect(relativeError(len3(c.p(t)), 2)).toBeLessThan(1e-12);
      const S = osculatingSphere(c, t)!;
      expect(relativeError(S.radius, 2)).toBeLessThan(1e-6);
      expect(len3(S.centre)).toBeLessThan(1e-6);
    }
  });
  it('Viviani: κ ≥ 1/2 = 1/radius everywhere on the sphere', () => {
    for (let i = 0; i <= 400; i++) {
      const t = -2 * Math.PI + (4 * Math.PI * i) / 400;
      expect(kappa(C.viviani, t)).toBeGreaterThanOrEqual(0.5 - 1e-12);
    }
  });
});

describe('convergence: the curve rebuilt from κ and τ', () => {
  it('constant κ = 0.8, τ = 0.4 rebuilds the helix of radius 1 and pitch parameter 0.5', () => {
    const R = rebuildLaw(SPACE_LAWS.const, 0.8, 0.4, 4 * Math.PI, { n: 2000 });
    // the axis of the rebuilt helix is the Darboux direction τt₀ + κb₀; distances to it are the radius 1
    const axis: Vec3 = scale3([0.4, 0, 0.8], 1 / Math.hypot(0.4, 0.8));
    const centre: Vec3 = [0, 1, 0]; // γ(0) + ρ_helix·n₀ where the helix radius is a = 1
    for (const p of R.pts.filter((_, i) => i % 250 === 0)) {
      const d = sub3(p, centre);
      const perp = sub3(d, scale3(axis, dot3(d, axis)));
      expect(relativeError(len3(perp), 1)).toBeLessThan(1e-8);
    }
  });
  it('the integrated frame stays orthonormal (the existence proof: FᵀF = I is preserved)', () => {
    // within the stated range: length ≤ 20, |κ|, |τ| ≤ 3 (the lancret law reaches κ = 3 at s = 8)
    for (const law of Object.values(SPACE_LAWS)) expect(rebuildLaw(law, law.c1, law.c2, 8).orthoDefect).toBeLessThan(1e-9);
  });
  it('a different starting point and frame give a congruent curve: all mutual distances agree', () => {
    const law = SPACE_LAWS.wave;
    const A = rebuildLaw(law, 1, 1, 8, { n: 1600 });
    const u: Vec3 = scale3([1, 2, 2], 1 / 3);
    const rot = (v: Vec3) => rotate(v, u, 1.1);
    const B = rebuildLaw(law, 1, 1, 8, { n: 1600, p0: [3, -1, 2], frame0: { t: rot([1, 0, 0]), n: rot([0, 1, 0]), b: rot([0, 0, 1]) } });
    for (const [i, j] of [[0, 400], [100, 1500], [700, 1200]]) expect(relativeError(dist(A.pts[i], A.pts[j]), dist(B.pts[i], B.pts[j]))).toBeLessThan(1e-9);
  });
  it('τ → −τ gives the mirror image: the reflection R in z = 0 maps the frame to (Rt, Rn, −Rb), so b₀ = e₃ stays', () => {
    const law = SPACE_LAWS['tau-linear'];
    const A = rebuildLaw(law, 1, 0.3, 6);
    const B = rebuildFromKT((s) => law.kappa(s, 1, 0.3), (s) => -law.tau(s, 1, 0.3), 6);
    for (const i of [0, 500, 1300, 2000]) expect(dist(B.pts[i], [A.pts[i][0], A.pts[i][1], -A.pts[i][2]])).toBeLessThan(1e-9);
  });
  it('τ ≡ 0 rebuilds a plane curve (the plane of t₀ and n₀)', () => {
    const R = rebuildFromKT((s) => 1 + 0.5 * Math.sin(s), () => 0, 10);
    expect(Math.max(...R.pts.map((p) => Math.abs(p[2])))).toBeLessThan(1e-12);
  });
  it('the rebuilt curve has unit speed: the length of the polygon through the samples tends to len', () => {
    const R = rebuildLaw(SPACE_LAWS.lancret, 1, 0.5, 5, { n: 4000 });
    let L = 0;
    for (let i = 1; i < R.pts.length; i++) L += dist(R.pts[i], R.pts[i - 1]);
    expect(relativeError(L, 5)).toBeLessThan(1e-5);
  });
});

describe('analytic limits: the planar cubic at its inflection (lesson 2.1.11)', () => {
  it('(t, t³, 0): κ(0) = 0; b = +e_z for t > 0 and −e_z for t < 0, n jumps from −e_y-ish to +e_y-ish', () => {
    const c = SPACE_CURVES['planar-cubic'];
    expect(kappa(c, 0)).toBe(0);
    for (const h of [0.2, 1e-3]) {
      expect(dist(frame(c, h)!.b, [0, 0, 1])).toBeLessThan(1e-12);
      expect(dist(frame(c, -h)!.b, [0, 0, -1])).toBeLessThan(1e-12);
    }
  });
});
