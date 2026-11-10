/**
 * Space figures drawn on a 2D canvas: an orthographic projection of ℝ³ with an orbit camera (drag or arrow keys),
 * depth cues and the frame arrows of the geometry colour code. Used by FrenetFrame and SpaceFromCurvature.
 *
 * Why a canvas projection and not three.js: the chapter-2 figures are curves, arrows, planes and circles, which a
 * projection draws exactly and crisply at any size; it needs no WebGL, so the same picture is the "2D fallback", and
 * nothing moves unless the reader moves it (still mode is automatic).
 *
 * The view is never mirrored: with right = (−sin φ, cos φ, 0), up = (−sin θ cos φ, −sin θ sin φ, cos θ) and
 * eye = (cos θ cos φ, cos θ sin φ, sin θ) we have right × up = eye, so a right-handed frame is drawn right-handed
 * and the sign of the torsion on screen is the true one.
 */

import type { Vec3 } from '~/math/vec';
import { add3, dot3, len3, scale3, sub3 } from '~/math/vec';
import type { Palette } from './canvas';
import { withAlpha } from './ink';

export interface Cam {
  /** azimuth φ of the eye around the z axis */
  yaw: number;
  /** elevation θ of the eye above the xy plane, in (−π/2, π/2) */
  pitch: number;
}

export interface Projector {
  /** screen x, screen y (CSS px), depth (larger = nearer the eye) */
  (p: Vec3): [number, number, number];
  /** pixels per world unit */
  scale: number;
  eye: Vec3;
  right: Vec3;
  up: Vec3;
  /** depth of the centre of the scene */
  depth0: number;
  /** half the depth range, for normalising depth cues */
  radius: number;
}

export function camBasis(cam: Cam): { right: Vec3; up: Vec3; eye: Vec3 } {
  const { yaw: f, pitch: q } = cam;
  return {
    right: [-Math.sin(f), Math.cos(f), 0],
    up: [-Math.sin(q) * Math.cos(f), -Math.sin(q) * Math.sin(f), Math.cos(q)],
    eye: [Math.cos(q) * Math.cos(f), Math.cos(q) * Math.sin(f), Math.sin(q)],
  };
}

/** A bounding ball of a point set (centre of the box, radius to the farthest point). */
export function bounds(pts: Vec3[]): { centre: Vec3; radius: number } {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let i = 0; i < 3; i++) {
    lo[i] = Math.min(lo[i], p[i]);
    hi[i] = Math.max(hi[i], p[i]);
  }
  const centre: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  let radius = 0;
  for (const p of pts) radius = Math.max(radius, len3(sub3(p, centre)));
  return { centre, radius: Math.max(radius, 1e-6) };
}

/** Project the ball (centre, radius) to fill a w × h box with margin `fill` (fraction of the half-size used). */
export function makeProjector(cam: Cam, centre: Vec3, radius: number, w: number, h: number, fill = 0.86): Projector {
  const { right, up, eye } = camBasis(cam);
  const scale = (fill * Math.min(w, h)) / (2 * radius);
  const cx = w / 2;
  const cy = h / 2;
  const f = ((p: Vec3) => {
    const d = sub3(p, centre);
    return [cx + dot3(d, right) * scale, cy - dot3(d, up) * scale, dot3(d, eye)] as [number, number, number];
  }) as Projector;
  f.scale = scale;
  f.eye = eye;
  f.right = right;
  f.up = up;
  f.depth0 = 0;
  f.radius = radius;
  return f;
}

/** 0 at the back of the scene, 1 at the front. */
const nearness = (P: Projector, depth: number) => Math.max(0, Math.min(1, 0.5 + depth / (2 * P.radius)));

/** A polyline in space with a depth cue: segments at the back are thinner and fainter. */
export function curve3(ctx: CanvasRenderingContext2D, P: Projector, pts: Vec3[], color: string, width = 2.6, minAlpha = 0.3) {
  // segments are grouped into BANDS depth bands, one path each, back to front: ~8 strokes instead of one per segment
  const BANDS = 8;
  const paths: Path2D[] = Array.from({ length: BANDS }, () => new Path2D());
  let prev = P(pts[0]);
  for (let i = 1; i < pts.length; i++) {
    const q = P(pts[i]);
    const band = Math.min(BANDS - 1, Math.floor(nearness(P, (prev[2] + q[2]) / 2) * BANDS));
    paths[band].moveTo(prev[0], prev[1]);
    paths[band].lineTo(q[0], q[1]);
    prev = q;
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  paths.forEach((path, band) => {
    const near = (band + 0.5) / BANDS;
    ctx.globalAlpha = minAlpha + (1 - minAlpha) * near;
    ctx.lineWidth = width * (0.65 + 0.35 * near);
    ctx.stroke(path);
  });
  ctx.restore();
}

export type Head = 'fill' | 'open' | 'bar';

/**
 * An arrow from `from` along `vec` (world units), with one of three distinct heads so the frame is never told
 * apart by colour alone: t a filled triangle, n an open chevron, b a filled triangle with a cross bar.
 */
export function arrow3(ctx: CanvasRenderingContext2D, P: Projector, from: Vec3, vec: Vec3, color: string, head: Head, width = 2.6) {
  const a = P(from);
  const b = P(add3(from, vec));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (L < 3) {
    // pointing at or away from the eye: a dot (towards) or a cross (away), as in physics drawings
    const towards = dot3(vec, P.eye) > 0;
    ctx.beginPath();
    if (towards) {
      ctx.arc(a[0], a[1], 5, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(a[0], a[1], 1.8, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.arc(a[0], a[1], 5, 0, 2 * Math.PI);
      ctx.moveTo(a[0] - 3.5, a[1] - 3.5);
      ctx.lineTo(a[0] + 3.5, a[1] + 3.5);
      ctx.moveTo(a[0] + 3.5, a[1] - 3.5);
      ctx.lineTo(a[0] - 3.5, a[1] + 3.5);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  const ux = dx / L;
  const uy = dy / L;
  const hl = Math.min(13, L * 0.45);
  const hw = hl * 0.5;
  const bx = b[0] - ux * hl;
  const by = b[1] - uy * hl;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(head === 'open' ? b[0] - ux * 2 : bx + ux * 2, head === 'open' ? b[1] - uy * 2 : by + uy * 2);
  ctx.stroke();
  ctx.beginPath();
  if (head === 'open') {
    ctx.moveTo(bx - uy * hw, by + ux * hw);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(bx + uy * hw, by - ux * hw);
    ctx.stroke();
  } else {
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(bx - uy * hw, by + ux * hw);
    ctx.lineTo(bx + uy * hw, by - ux * hw);
    ctx.closePath();
    ctx.fill();
    if (head === 'bar') {
      const cx = bx - ux * 3;
      const cy = by - uy * 3;
      ctx.beginPath();
      ctx.moveTo(cx - uy * hw * 1.1, cy + ux * hw * 1.1);
      ctx.lineTo(cx + uy * hw * 1.1, cy - ux * hw * 1.1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A text label placed just past the tip of an arrow (screen offset away from the base). */
export function label3(ctx: CanvasRenderingContext2D, pal: Palette, P: Projector, at: Vec3, dir: Vec3, text: string, color: string, gap = 14) {
  const a = P(at);
  const b = P(add3(at, dir));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const x = b[0] + (dx / L) * gap;
  const y = b[1] + (dy / L) * gap;
  tag(ctx, pal, text, L < 3 ? a[0] + 14 : x, L < 3 ? a[1] - 12 : y, color);
}

export function tag(ctx: CanvasRenderingContext2D, pal: Palette, text: string, x: number, y: number, color: string, size = 15) {
  ctx.save();
  ctx.font = `italic 700 ${size}px ${pal.fontUi}`;
  ctx.direction = 'ltr';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = pal.paper;
  ctx.lineWidth = 4;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** A square patch of the plane through c spanned by the orthonormal u, v, half-side `half`. */
export function planePatch(ctx: CanvasRenderingContext2D, P: Projector, c: Vec3, u: Vec3, v: Vec3, half: number, color: string, fillAlpha = 0.13) {
  const corners = [
    add3(c, add3(scale3(u, half), scale3(v, half))),
    add3(c, add3(scale3(u, -half), scale3(v, half))),
    add3(c, add3(scale3(u, -half), scale3(v, -half))),
    add3(c, add3(scale3(u, half), scale3(v, -half))),
  ].map(P);
  ctx.save();
  ctx.beginPath();
  corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = withAlpha(color, fillAlpha);
  ctx.fill();
  ctx.strokeStyle = withAlpha(color, 0.55);
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.restore();
}

/** The circle with centre c and radius r in the plane spanned by the orthonormal u, v. */
export function circle3(ctx: CanvasRenderingContext2D, P: Projector, c: Vec3, u: Vec3, v: Vec3, r: number, color: string, width = 1.8, dash: number[] = []) {
  const pts: Vec3[] = [];
  for (let i = 0; i <= 120; i++) {
    const a = (2 * Math.PI * i) / 120;
    pts.push(add3(c, add3(scale3(u, r * Math.cos(a)), scale3(v, r * Math.sin(a)))));
  }
  ctx.save();
  ctx.setLineDash(dash);
  curve3(ctx, P, pts, color, width, 0.35);
  ctx.restore();
}

/** The outline of a sphere (an orthographic projection draws a disc) and its equator for depth. */
export function sphere3(ctx: CanvasRenderingContext2D, P: Projector, c: Vec3, r: number, color: string) {
  const [x, y] = P(c);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r * P.scale, 0, 2 * Math.PI);
  ctx.fillStyle = withAlpha(color, 0.06);
  ctx.fill();
  ctx.strokeStyle = withAlpha(color, 0.5);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.setLineDash([3, 4]);
  circle3(ctx, P, c, [1, 0, 0], [0, 1, 0], r, withAlpha(color, 0.6), 1);
  ctx.restore();
}

/** A small x, y, z triad in a corner so the reader sees how the view is turned (and that it is right-handed). */
export function axisTriad(ctx: CanvasRenderingContext2D, pal: Palette, cam: Cam, x: number, y: number, size = 26) {
  const { right, up, eye } = camBasis(cam);
  const axes: [Vec3, string][] = [[[1, 0, 0], 'x'], [[0, 1, 0], 'y'], [[0, 0, 1], 'z']];
  axes
    .map(([e, name]) => ({ e, name, d: dot3(e, eye) }))
    .sort((p, q) => p.d - q.d)
    .forEach(({ e, name }) => {
      const ex = x + dot3(e, right) * size;
      const ey = y - dot3(e, up) * size;
      ctx.save();
      ctx.strokeStyle = pal.ink3;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();
      tag(ctx, pal, name, x + dot3(e, right) * (size + 9), y - dot3(e, up) * (size + 9), pal.ink2, 12);
    });
}

/** Clamp an orbit change; the pitch stays off the poles so `up` never degenerates. */
export function orbit(cam: Cam, dYaw: number, dPitch: number): Cam {
  return { yaw: cam.yaw + dYaw, pitch: Math.max(-1.5, Math.min(1.5, cam.pitch + dPitch)) };
}

/** Pointer and keyboard handlers that orbit the camera. `onChange` gets the new camera. */
export function orbitHandlers(get: () => Cam, onChange: (c: Cam) => void) {
  let drag: { x: number; y: number; id: number } | null = null;
  return {
    onPointerDown: (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      onChange(orbit(get(), -dx * 0.01, dy * 0.01));
    },
    onPointerUp: () => {
      drag = null;
    },
    onKeyDown: (e: KeyboardEvent) => {
      const m: Record<string, [number, number]> = { ArrowLeft: [0.12, 0], ArrowRight: [-0.12, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] };
      const d = m[e.key];
      if (!d) return;
      e.preventDefault();
      onChange(orbit(get(), d[0], d[1]));
    },
  };
}

/** The angle (degrees) between the view direction and a unit vector: 0 when looking straight along it. */
export function viewAngleTo(cam: Cam, v: Vec3): number {
  const { eye } = camBasis(cam);
  return (Math.acos(Math.min(1, Math.abs(dot3(eye, v)))) * 180) / Math.PI;
}
