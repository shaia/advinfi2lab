/**
 * src/math/surfaces.ts, filed by accuracy category. Each test is named after the claim it checks.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import { partials } from '~/math/geometry';
import {
  CONE_SECTOR,
  DOMAIN_CURVES,
  SURFACES3,
  cosAngle,
  crossUV,
  efg,
  lengthInDomain,
  lengthOnSurface,
  paramAngleCos,
  polygonLengthOnSurface,
  regularity,
  rolledSector,
  rolledStrip,
  swapped,
  unitNormal3,
} from '~/math/surfaces';
import { dot3, len3, scale3, sub3, type Vec3 } from '~/math/vec';

const S = SURFACES3;
const dist = (a: Vec3, b: Vec3) => len3(sub3(a, b));
const { PI, cos, sin, sqrt, E: e } = Math;
const at = (s: (typeof S)[string], fu: number, fv: number): [number, number] => [s.u0 + fu * (s.u1 - s.u0), s.v0 + fv * (s.v1 - s.v0)];

describe('exact identities: the closed-form partials are the partials', () => {
  for (const s of Object.values(S)) {
    it(`${s.id}: σ_u, σ_v, σ_uu, σ_uv, σ_vv agree with central differences at interior points`, () => {
      for (const [fu, fv] of [[0.21, 0.33], [0.47, 0.71], [0.83, 0.12]]) {
        const [u, v] = at(s, fu, fv);
        const fd = partials(s.p, u, v, 1e-4);
        expect(dist(s.su(u, v), fd.su)).toBeLessThan(1e-6);
        expect(dist(s.sv(u, v), fd.sv)).toBeLessThan(1e-6);
        expect(dist(s.suu(u, v), fd.suu)).toBeLessThan(1e-3);
        expect(dist(s.suv(u, v), fd.suv)).toBeLessThan(1e-3);
        expect(dist(s.svv(u, v), fd.svv)).toBeLessThan(1e-3);
      }
    });
  }
});

describe('exact identities: regularity, normals and the first form', () => {
  it('Lagrange: EG − F² = ‖σ_u × σ_v‖² on every preset', () => {
    for (const s of Object.values(S)) {
      const [u, v] = at(s, 0.37, 0.58);
      const { E, F, G } = efg(s, u, v);
      expect(relativeError(E * G - F * F, regularity(s, u, v) ** 2)).toBeLessThan(1e-12);
    }
  });

  it('sphere: σ_u × σ_v = cos v · σ (outward), not regular exactly at the poles', () => {
    const s = S.sphere;
    for (const [u, v] of [[0.3, 0.4], [2.5, -1.1], [5, 1.2]]) {
      expect(dist(crossUV(s, u, v), scale3(s.p(u, v), cos(v)))).toBeLessThan(1e-14);
    }
    expect(regularity(s, 1, PI / 2)).toBeLessThan(1e-15);
    expect(unitNormal3(s, 1, PI / 2)).toBeNull();
  });

  it('sphere (colatitude): σ_u × σ_v = sin u · σ, E = 1, F = 0, G = sin²u', () => {
    const s = S['sphere-colat'];
    for (const [u, v] of [[0.3, 0.4], [2.5, 4.1]]) {
      expect(dist(crossUV(s, u, v), scale3(s.p(u, v), sin(u)))).toBeLessThan(1e-14);
      const { E, F, G } = efg(s, u, v);
      expect(Math.abs(E - 1)).toBeLessThan(1e-15);
      expect(Math.abs(F)).toBeLessThan(1e-15);
      expect(relativeError(G, sin(u) ** 2)).toBeLessThan(1e-14);
    }
  });

  it('surface of revolution: ‖σ_u × σ_v‖ = |f|√(f′² + g′²) (torus: r(R + r cos v), cone: √2|v|)', () => {
    for (const v of [0, 1, PI / 2, 2.5, PI]) expect(relativeError(regularity(S.torus, 0.7, v), 3 + cos(v))).toBeLessThan(1e-14);
    for (const v of [-1, -0.3, 0.8]) expect(relativeError(regularity(S.cone, 0.7, v), sqrt(2) * Math.abs(v))).toBeLessThan(1e-14);
    expect(regularity(S.cone, 0.7, 0)).toBe(0);
    expect(regularity(S['plane-polar'], 0, 1)).toBe(0);
  });

  it('graph: σ_x × σ_y = (−f_x, −f_y, 1); the hemisphere graph is regular at the pole', () => {
    const c = crossUV(S.saddle, 1, 2);
    expect(dist(c, [-2, 4, 1])).toBeLessThan(1e-15);
    expect(dist(unitNormal3(S['sphere-graph'], 0, 0)!, [0, 0, 1])).toBeLessThan(1e-15);
  });

  it('Q-3.3-normal-saddle: third component of N̂ of z = x² − y² at (1, 2) is 1/√21', () => {
    expect(relativeError(unitNormal3(S.saddle, 1, 2)![2], 1 / sqrt(21))).toBeLessThan(1e-14);
  });

  it('swapping the parameters keeps the point and reverses N̂', () => {
    for (const s of [S.sphere, S.torus, S.saddle, S.mobius]) {
      const w = swapped(s);
      const [u, v] = at(s, 0.31, 0.62);
      expect(dist(w.p(v, u), s.p(u, v))).toBe(0);
      expect(dist(unitNormal3(w, v, u)!, scale3(unitNormal3(s, u, v)!, -1))).toBeLessThan(1e-14);
    }
  });

  it('Möbius: σ(u + 2π, −v) = σ(u, v), regular for |v| < 1, and N̂(2π, 0) = −N̂(0, 0) (Q-3.3-mobius-dot = −1)', () => {
    const m = S.mobius;
    for (const [u, v] of [[0.4, 0.5], [2, -0.7], [-1, 0.2]]) expect(dist(m.p(u + 2 * PI, -v), m.p(u, v))).toBeLessThan(1e-14);
    let minReg = Infinity;
    for (let i = 0; i <= 200; i++) for (let j = 0; j <= 40; j++) minReg = Math.min(minReg, regularity(m, (2 * PI * i) / 200, -0.999 + (1.998 * j) / 40));
    expect(minReg).toBeGreaterThan(0.5);
    expect(dist(unitNormal3(m, 0, 0)!, [0, 0, -1])).toBeLessThan(1e-15);
    expect(dot3(unitNormal3(m, 0, 0)!, unitNormal3(m, 2 * PI, 0)!)).toBeCloseTo(-1, 14);
  });
});

describe('analytic values: the banks\' keys', () => {
  it('Q-3.4-torus-e: E = (3 + cos π/3)² = 12.25', () => {
    expect(relativeError(efg(S.torus, 0.4, PI / 3).E, 12.25)).toBeLessThan(1e-14);
  });

  it('Q-3.4-graph-gram: EG − F² = 1 + f_x² + f_y² = 21 for z = x² − y² at (1, 2)', () => {
    const { E, F, G } = efg(S.saddle, 1, 2);
    expect(relativeError(E * G - F * F, 21)).toBeLessThan(1e-14);
  });

  it('parameter-curve angle on z = x² − y²: cos θ = F/√(EG) = −8/√85 at (1, 2), and −12/√185 at (1, 3) (Q-3.4-param-angle)', () => {
    expect(relativeError(paramAngleCos(S.saddle, 1, 2), -8 / sqrt(85))).toBeLessThan(1e-14);
    expect(relativeError(paramAngleCos(S.saddle, 1, 3), -12 / sqrt(185))).toBeLessThan(1e-14);
  });

  it('Q-3-review-09: the oblique plane (u + v, v, 0) has cos θ = 1/√2 everywhere', () => {
    expect(relativeError(paramAngleCos(S['plane-oblique'], 0.3, -0.2), 1 / sqrt(2))).toBeLessThan(1e-14);
  });

  it('angles from E, F, G on the unit sphere: σ_u ± σ_v at v = π/3 give −3/5; σ_u + σ_v and σ_u − 2σ_v at v = π/4 give −1/√3 (Q-3.4-sphere-angle)', () => {
    expect(relativeError(cosAngle(S.sphere, 0.5, PI / 3, 1, 1, 1, -1), -3 / 5)).toBeLessThan(1e-14);
    expect(relativeError(cosAngle(S.sphere, 0.5, PI / 4, 1, 1, 1, -2), -1 / sqrt(3))).toBeLessThan(1e-14);
  });
});

describe('convergence: lengths from the first form against the inscribed polygon', () => {
  const cases: [string, string, number][] = [
    ['sphere', 'latitude', 2 * PI * cos(PI / 3)],
    ['sphere-colat', 'cap-circle', 2 * PI * sin(PI / 6)],
    ['sphere-colat', 'meridian', PI],
    ['cylinder', 'helix', 2 * PI * sqrt(1 + 1 / 16)],
    ['torus', 'outer', 2 * PI * 4],
    ['torus', 'inner', 2 * PI * 2],
    ['plane-oblique', 'diag', sqrt(5)],
  ];
  for (const [sid, cid, exact] of cases) {
    it(`${sid} / ${cid}: ∫√Q₁ equals the exact length and the polygon converges to it`, () => {
      const c = DOMAIN_CURVES[sid].find((x) => x.id === cid)!;
      const L = lengthOnSurface(S[sid], c);
      expect(relativeError(L, exact)).toBeLessThan(1e-10);
      expect(relativeError(polygonLengthOnSurface(S[sid], c), exact)).toBeLessThan(1e-6);
    });
  }

  it('Q-3-review-05 (scaled): on the cone, u = t, v = eᵗ/3 has length √3(e − 1)/3', () => {
    const c = DOMAIN_CURVES.cone[0];
    expect(relativeError(lengthOnSurface(S.cone, c), (sqrt(3) * (e - 1)) / 3)).toBeLessThan(1e-10);
  });

  it('the parameter-plane length is not the length on the surface (latitude: 2π against π)', () => {
    const c = DOMAIN_CURVES.sphere[0];
    expect(relativeError(lengthInDomain(c), 2 * PI)).toBeLessThan(1e-12);
    expect(relativeError(lengthOnSurface(S.sphere, c), PI)).toBeLessThan(1e-10);
  });
});

describe('exact identities: bending is an isometry', () => {
  it('rolled strip: E = 1, F = 0, G = 1 for every λ, and λ = 1 is the unit cylinder', () => {
    for (const l of [0, 0.25, 0.6, 1]) {
      const s = rolledStrip(l);
      for (const [x, y] of [[-2, 0.3], [0.5, 1.2], [3, 0.7]]) {
        const { E, F, G } = efg(s, x, y);
        expect(Math.abs(E - 1) + Math.abs(F) + Math.abs(G - 1)).toBeLessThan(1e-15);
      }
    }
    const p = rolledStrip(1).p(1.3, 0.4);
    expect(relativeError(Math.hypot(p[0], p[1] - 1), 1)).toBeLessThan(1e-14);
  });

  it('rolled strip: the straight line keeps its length while it becomes a helix', () => {
    const c = DOMAIN_CURVES.roll[0];
    const exact = 2 * PI * sqrt(1 + 1 / 16);
    for (const l of [0, 0.5, 1]) expect(relativeError(polygonLengthOnSurface(rolledStrip(l), c), exact)).toBeLessThan(1e-6);
  });

  it('rolled sector: E = 1, F = 0, G = r² for every λ, and λ = 1 is the cone (v cos u, v sin u, v)', () => {
    for (const l of [0, 0.5, 1]) {
      const s = rolledSector(l);
      const { E, F, G } = efg(s, 1.2, 0.7);
      expect(Math.abs(E - 1) + Math.abs(F) + Math.abs(G - 1.44)).toBeLessThan(1e-14);
    }
    const r = 1.1;
    const f = 0.9;
    const q = rolledSector(1).p(r, f);
    const v = r / sqrt(2);
    const u = sqrt(2) * f;
    expect(dist(q, [v * cos(u), v * sin(u), v])).toBeLessThan(1e-14);
    expect(relativeError(CONE_SECTOR, sqrt(2) * PI)).toBe(0);
  });

  it('rolled sector: a straight segment of the sector keeps its length on every cone of the family', () => {
    const c = DOMAIN_CURVES['cone-roll'][0];
    for (const l of [0, 0.5, 1]) expect(relativeError(polygonLengthOnSurface(rolledSector(l), c), 2.2)).toBeLessThan(1e-6);
  });
});
