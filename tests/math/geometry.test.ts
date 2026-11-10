/**
 * The probes in src/math/geometry.ts, vectorcalc.ts and approx.ts, filed by accuracy category. Each test is
 * named after the mathematical claim it checks.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import { len3, sub3, dot3, type Vec3 } from '~/math/vec';
import { fourierCoeffs } from '~/math/multivar';
import {
  CURVES,
  SURFACES,
  arcLength,
  curvature,
  curvatures,
  curveFromCurvature,
  curveOnSurface,
  frenet,
  normalCurvature,
  osculatingCentre,
  planeCurveFromCurvature,
  signedCurvature,
  surfaceArea,
  torsion,
  totalCurvature,
} from '~/math/geometry';
import { boxIntegral, curl, div, flux, grad, inverseSquare, lineIntegral, scalarLineIntegral, windingField } from '~/math/vectorcalc';
import { besselSum, legendre, orthonormalPolys, polyEval, polyInner, projectOntoPolys } from '~/math/approx';

const PI = Math.PI;

describe('analytic limits: curves', () => {
  it('a circle of radius r has curvature 1/r and its osculating circle is itself', () => {
    const g = CURVES.circle(2.5);
    expect(relativeError(curvature(g, 0.7), 1 / 2.5)).toBeLessThan(1e-8);
    expect(len3(osculatingCentre(g, 0.7))).toBeLessThan(1e-7);
  });
  it('the helix (a cos t, a sin t, bt) has κ = a/(a²+b²) and τ = b/(a²+b²)', () => {
    const [a, b] = [2, 0.5];
    const g = CURVES.helix(a, b);
    expect(relativeError(curvature(g, 1.1), a / (a * a + b * b))).toBeLessThan(1e-8);
    expect(relativeError(torsion(g, 1.1), b / (a * a + b * b))).toBeLessThan(1e-6);
  });
  it('a left-handed helix has negative torsion with the sign convention b′ = −τn', () => {
    expect(torsion(CURVES.helix(1, -1), 0.3)).toBeLessThan(0);
  });
  it('the twisted cubic (t, t², t³) at t = 0 has κ = 2 and τ = 3', () => {
    const g = CURVES.twistedCubic();
    expect(relativeError(curvature(g, 0), 2)).toBeLessThan(1e-8);
    expect(relativeError(torsion(g, 0), 3)).toBeLessThan(1e-6);
  });
  it('a plane curve has zero torsion', () => {
    expect(Math.abs(torsion((t) => [t, Math.sin(t), 0], 0.4))).toBeLessThan(1e-9);
  });
  it('one arch of the cycloid of radius r has length 8r', () => {
    expect(relativeError(arcLength(CURVES.cycloid(1.5), 0, 2 * PI), 12)).toBeLessThan(1e-6);
  });
  it('one turn of the helix has length 2π√(a²+b²)', () => {
    expect(relativeError(arcLength(CURVES.helix(3, 4), 0, 2 * PI), 10 * PI)).toBeLessThan(1e-9);
  });
  it('the signed curvature of a circle is +1/r counter-clockwise and −1/r clockwise', () => {
    expect(relativeError(signedCurvature(CURVES.circle(2), 1), 0.5)).toBeLessThan(1e-8);
    expect(relativeError(signedCurvature((t) => [2 * Math.cos(-t), 2 * Math.sin(-t), 0], 1), -0.5)).toBeLessThan(1e-8);
  });
  it('the Frenet frame is orthonormal and right-handed', () => {
    const { t, n, b } = frenet(CURVES.twistedCubic(), 0.6);
    for (const [x, y] of [[t, n], [n, b], [t, b]] as [Vec3, Vec3][]) expect(Math.abs(dot3(x, y))).toBeLessThan(1e-9);
    const tn: Vec3 = [t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]];
    expect(len3(sub3(tn, b))).toBeLessThan(1e-9);
  });
});

describe('analytic limits: surfaces', () => {
  it('a sphere of radius r has K = 1/r² and |H| = 1/r at every point (all points umbilic)', () => {
    const { K, H, k1, k2 } = curvatures(SURFACES.sphere(2), 0.4, 0.3);
    expect(relativeError(K, 0.25)).toBeLessThan(1e-6);
    expect(relativeError(Math.abs(H), 0.5)).toBeLessThan(1e-6);
    expect(Math.abs(k1 - k2)).toBeLessThan(1e-3);
  });
  it('a cylinder of radius r has K = 0 and |H| = 1/(2r)', () => {
    const { K, H } = curvatures(SURFACES.cylinder(2), 0.4, 0.3);
    expect(Math.abs(K)).toBeLessThan(1e-7);
    expect(relativeError(Math.abs(H), 0.25)).toBeLessThan(1e-6);
  });
  it('the catenoid is minimal: H = 0, and K = −1/(c² cosh⁴(v/c))', () => {
    const c = 1.5, v = 0.7;
    const { K, H } = curvatures(SURFACES.catenoid(c), 0.2, v);
    expect(Math.abs(H)).toBeLessThan(1e-7);
    expect(relativeError(K, -1 / (c * c * Math.cosh(v / c) ** 4))).toBeLessThan(1e-6);
  });
  it('the torus has K = 1/(r(R+r)) on the outer equator and −1/(r(R−r)) on the inner one', () => {
    const [R, r] = [3, 1];
    expect(relativeError(curvatures(SURFACES.torus(R, r), 0.5, 0).K, 1 / (r * (R + r)))).toBeLessThan(1e-6);
    expect(relativeError(curvatures(SURFACES.torus(R, r), 0.5, PI).K, -1 / (r * (R - r)))).toBeLessThan(1e-6);
  });
  it('the saddle z = xy has K = −1 and H = 0 at the origin', () => {
    const { K, H } = curvatures(SURFACES.graph((x, y) => x * y), 0, 0);
    expect(relativeError(K, -1)).toBeLessThan(1e-6);
    expect(Math.abs(H)).toBeLessThan(1e-8);
  });
  it('Euler: the normal curvature at angle θ from a principal direction is κ₁cos²θ + κ₂sin²θ', () => {
    // z = (x² + 3y²)/2 at the origin: principal directions are the axes, κ₁ = 3, κ₂ = 1
    const s = SURFACES.graph((x, y) => (x * x + 3 * y * y) / 2);
    const th = 0.6;
    expect(relativeError(normalCurvature(s, 0, 0, Math.cos(th), Math.sin(th)), Math.cos(th) ** 2 + 3 * Math.sin(th) ** 2)).toBeLessThan(1e-6);
  });
  it('a parallel of latitude v on the unit sphere has κ_n = ±1 and κ_g = ±tan v, so κ² = κ_n² + κ_g²', () => {
    const v = 0.5;
    const { kn, kg, k } = curveOnSurface(SURFACES.sphere(1), (t) => [t, v], 0.3);
    expect(relativeError(Math.abs(kn), 1)).toBeLessThan(1e-6);
    expect(relativeError(Math.abs(kg), Math.tan(v))).toBeLessThan(1e-6);
    expect(relativeError(kn * kn + kg * kg, k * k)).toBeLessThan(1e-6);
  });
  it('a great circle (the equator) is a geodesic: κ_g = 0', () => {
    expect(Math.abs(curveOnSurface(SURFACES.sphere(1), (t) => [t, 0], 0.3).kg)).toBeLessThan(1e-8);
  });
});

describe('exact identities and integral theorems', () => {
  it('the sphere of radius r has area 4πr² and the torus 4π²Rr', () => {
    expect(relativeError(surfaceArea(SURFACES.sphere(2), 0, 2 * PI, -PI / 2, PI / 2), 16 * PI)).toBeLessThan(1e-6);
    expect(relativeError(surfaceArea(SURFACES.torus(3, 1), 0, 2 * PI, 0, 2 * PI), 12 * PI * PI)).toBeLessThan(1e-8);
  });
  it('total curvature: 4π on the sphere, 0 on the torus', () => {
    expect(relativeError(totalCurvature(SURFACES.sphere(3), 0, 2 * PI, -PI / 2 + 1e-4, PI / 2 - 1e-4), 4 * PI)).toBeLessThan(1e-5);
    expect(Math.abs(totalCurvature(SURFACES.torus(3, 1), 0, 2 * PI, 0, 2 * PI))).toBeLessThan(1e-6);
  });
  it('curl grad = 0 and div curl = 0 (to finite-difference accuracy)', () => {
    const phi = ([x, y, z]: Vec3) => Math.sin(x * y) + z * z * x;
    const F = ([x, y, z]: Vec3): Vec3 => [y * z * z, Math.exp(x) * y, x * y * z];
    expect(len3(curl((p) => grad(phi, p), [0.3, -0.2, 0.5]))).toBeLessThan(1e-6);
    expect(Math.abs(div((p) => curl(F, p), [0.3, -0.2, 0.5]))).toBeLessThan(1e-6);
  });
  it('Green: the circulation of (−y, x) around the unit circle is twice the area enclosed', () => {
    expect(relativeError(lineIntegral(([x, y]) => [-y, x, 0], CURVES.circle(1), 0, 2 * PI), 2 * PI)).toBeLessThan(1e-9);
  });
  it('the winding field has curl 0 off the axis and circulation 2π around it', () => {
    expect(len3(curl(windingField, [1, 0.5, 0]))).toBeLessThan(1e-7);
    expect(relativeError(lineIntegral(windingField, CURVES.circle(0.3), 0, 2 * PI), 2 * PI)).toBeLessThan(1e-9);
  });
  it('Gauss: the flux of (x, y, z) out of the unit cube equals ∭ div = 3', () => {
    expect(relativeError(boxIntegral((p) => div(([x, y, z]) => [x, y, z], p), [0, 1], [0, 1], [0, 1], 10), 3)).toBeLessThan(1e-8);
  });
  it('the inverse-square field has flux 4π through a sphere around the origin', () => {
    // the sphere parametrization (u = longitude, v = latitude) has σ_u × σ_v pointing outward
    expect(relativeError(flux(inverseSquare, SURFACES.sphere(2), 0, 2 * PI, -PI / 2, PI / 2), 4 * PI)).toBeLessThan(1e-6);
  });
  it('the mass of a helix turn with density z equals the closed form', () => {
    // ∫ bt √(a²+b²) dt over [0, 2π] = 2π² b √(a²+b²)
    const [a, b] = [1, 1];
    expect(relativeError(scalarLineIntegral(([, , z]) => z, CURVES.helix(a, b), 0, 2 * PI), 2 * PI * PI * b * Math.SQRT2)).toBeLessThan(1e-9);
  });
});

describe('reconstruction from curvature (existence and uniqueness, numerically)', () => {
  it('constant κ, τ rebuild a helix: the point after arc length s matches the helix', () => {
    const [a, b] = [2, 1];
    const c = Math.sqrt(a * a + b * b);
    const pts = curveFromCurvature(() => a / (c * c), () => b / (c * c), 2 * PI * c, 4000);
    // with frame t0 = e1, n0 = e2, b0 = e3 at the origin the curve is a helix about an axis tilted from e3;
    // what must match is an invariant: the chord after one full turn has length 2πb
    expect(relativeError(len3(pts[pts.length - 1]), 2 * PI * b)).toBeLessThan(1e-8);
  });
  it('signed curvature k ≡ 1 closes a unit circle after arc length 2π', () => {
    const pts = planeCurveFromCurvature(() => 1, 2 * PI, 2000);
    expect(len3(pts[pts.length - 1])).toBeLessThan(1e-10);
  });
});

describe('convergence', () => {
  it('Simpson arc length converges at fourth order on the ellipse', () => {
    const g = (t: number): Vec3 => [2 * Math.cos(t), Math.sin(t), 0];
    const ref = arcLength(g, 0, 1, 4000);
    const e1 = Math.abs(arcLength(g, 0, 1, 10) - ref);
    const e2 = Math.abs(arcLength(g, 0, 1, 20) - ref);
    expect(e1 / e2).toBeGreaterThan(12);
  });
});

describe('approximation', () => {
  it('Gram–Schmidt on monomials in L²[−1, 1] gives multiples of the Legendre polynomials', () => {
    const basis = orthonormalPolys(4, -1, 1);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) expect(Math.abs(polyInner(basis[i], basis[j], -1, 1) - (i === j ? 1 : 0))).toBeLessThan(1e-10);
    // eₙ = √((2n+1)/2) Pₙ
    expect(relativeError(polyEval(basis[3], 0.4), Math.sqrt(3.5) * legendre(3, 0.4))).toBeLessThan(1e-10);
  });
  it('the best linear approximation of x² on [0, 1] is x − 1/6, at distance 1/√180', () => {
    const { poly, dist } = projectOntoPolys((x) => x * x, 1, 0, 1);
    expect(relativeError(poly[0], -1 / 6)).toBeLessThan(1e-9);
    expect(relativeError(poly[1], 1)).toBeLessThan(1e-9);
    expect(relativeError(dist, 1 / Math.sqrt(180))).toBeLessThan(1e-6);
  });
  it('Bessel ≤ (1/π)∫f², and the gap closes (Parseval) for f(x) = x', () => {
    const c = fourierCoeffs((x) => x, 200);
    const total = (2 * PI ** 2) / 3; // (1/π)∫x² over [−π, π]
    expect(besselSum(c, 50)).toBeLessThan(total);
    expect(relativeError(besselSum(c, 200), total)).toBeLessThan(4e-3);
  });
});
