/**
 * A parametrized surface drawn on the canvas projection of space.ts: a mesh of small quads painted back to front
 * (painter's algorithm), each shaded by the angle its normal makes with a fixed light, with the parameter grid drawn
 * on the quads' edges so it is hidden where the surface hides it.
 *
 * The two sides of the surface get two colours: the side N̂ = σ_u × σ_v / ‖σ_u × σ_v‖ points out of is painted in
 * the "front" colour, the other side in the "back" colour. So swapping the parameters swaps the colours, and on the
 * Möbius band the colours meet along the seam u = 0 = 2π: the picture shows the orientation, not only the shape.
 *
 * No WebGL (the reason space.ts gives for chapter 2 holds here too): exact, crisp, and still mode for free.
 */

import { cross3, dot3, len3, scale3, add3, type Vec3 } from '~/math/vec';
import type { SurfaceDef } from '~/math/surfaces';
import type { Palette } from './canvas';
import { mix, withAlpha } from './ink';
import type { Projector } from './space';

export interface MeshOptions {
  /** cells along u and along v */
  nu?: number;
  nv?: number;
  /** a parameter line every `every` cells */
  every?: number;
  /** colours of the side N̂ points out of, and of the other side */
  front: string;
  back: string;
  /** draw the parameter grid */
  grid?: boolean;
}

interface Quad {
  pts: [number, number][];
  depth: number;
  fill: string;
  /** which of the edges (bottom v = j, right u = i + 1, top v = j + 1, left u = i) lie on a grid line */
  edges: [boolean, boolean, boolean, boolean];
}

/** Sample σ on the (nu + 1) × (nv + 1) grid of its rectangle. */
export function sampleSurface(s: SurfaceDef, nu: number, nv: number): Vec3[][] {
  const rows: Vec3[][] = [];
  for (let i = 0; i <= nu; i++) {
    const u = s.u0 + ((s.u1 - s.u0) * i) / nu;
    const row: Vec3[] = [];
    for (let j = 0; j <= nv; j++) row.push(s.p(u, s.v0 + ((s.v1 - s.v0) * j) / nv));
    rows.push(row);
  }
  return rows;
}

/** Paint the surface. Returns nothing; everything drawn after it lies on top. */
export function drawSurface(ctx: CanvasRenderingContext2D, P: Projector, pal: Palette, s: SurfaceDef, o: MeshOptions) {
  const nu = o.nu ?? 64;
  const nv = o.nv ?? 32;
  const every = o.every ?? 4;
  const grid = sampleSurface(s, nu, nv);
  const scr = grid.map((row) => row.map((p) => P(p)));
  const light = norm(add3(add3(P.eye, scale3(P.up, 0.7)), scale3(P.right, -0.35)));
  const quads: Quad[] = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const u = s.u0 + ((s.u1 - s.u0) * (i + 0.5)) / nu;
      const v = s.v0 + ((s.v1 - s.v0) * (j + 0.5)) / nv;
      let n = cross3(s.su(u, v), s.sv(u, v));
      if (len3(n) < 1e-12) {
        // a degenerate cell (pole, vertex): use the diagonals of the quad itself
        n = cross3(sub(grid[i + 1][j + 1], grid[i][j]), sub(grid[i][j + 1], grid[i + 1][j]));
      }
      const nn = norm(n);
      const facing = dot3(nn, P.eye);
      const lam = Math.abs(dot3(nn, light));
      const side = facing >= 0 ? o.front : o.back;
      const fill = mix(pal.paper, side, 0.1 + 0.34 * lam);
      const a = scr[i][j];
      const b = scr[i + 1][j];
      const c = scr[i + 1][j + 1];
      const d = scr[i][j + 1];
      quads.push({
        pts: [[a[0], a[1]], [b[0], b[1]], [c[0], c[1]], [d[0], d[1]]],
        depth: (a[2] + b[2] + c[2] + d[2]) / 4,
        fill,
        edges: [j % every === 0, (i + 1) % every === 0 || i + 1 === nu, (j + 1) % every === 0 || j + 1 === nv, i % every === 0],
      });
    }
  }
  quads.sort((p, q) => p.depth - q.depth);
  const gridColor = withAlpha(pal.ink2, 0.5);
  ctx.save();
  ctx.lineJoin = 'round';
  for (const q of quads) {
    ctx.beginPath();
    q.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = q.fill;
    ctx.fill();
    // a hairline of the same colour hides the seams between neighbouring quads
    ctx.strokeStyle = q.fill;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    if (o.grid !== false) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        if (!q.edges[k]) continue;
        const [x1, y1] = q.pts[k];
        const [x2, y2] = q.pts[(k + 1) % 4];
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: Vec3): Vec3 => {
  const l = len3(a);
  return l < 1e-15 ? [0, 0, 1] : scale3(a, 1 / l);
};

/**
 * The parameter domain as a small inset: the rectangle [u0, u1] × [v0, v1] with its grid, u growing to the right and
 * v upwards (math space, LTR), the current point, and optionally a curve of the domain.
 */
export function drawDomainInset(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  s: SurfaceDef,
  box: { x: number; y: number; w: number; h: number },
  point: [number, number],
  curve?: { pts: [number, number][]; upto: number },
  every = 4,
  nu = 64,
  nv = 32,
) {
  const X = (u: number) => box.x + ((u - s.u0) / (s.u1 - s.u0)) * box.w;
  const Y = (v: number) => box.y + box.h - ((v - s.v0) / (s.v1 - s.v0)) * box.h;
  ctx.save();
  ctx.fillStyle = withAlpha(pal.paper, 0.92);
  ctx.strokeStyle = pal.ink3;
  ctx.lineWidth = 1;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = withAlpha(pal.ink2, 0.35);
  ctx.beginPath();
  for (let i = every; i < nu; i += every) {
    const x = X(s.u0 + ((s.u1 - s.u0) * i) / nu);
    ctx.moveTo(x, box.y);
    ctx.lineTo(x, box.y + box.h);
  }
  for (let j = every; j < nv; j += every) {
    const y = Y(s.v0 + ((s.v1 - s.v0) * j) / nv);
    ctx.moveTo(box.x, y);
    ctx.lineTo(box.x + box.w, y);
  }
  ctx.stroke();
  if (curve && curve.pts.length > 1) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = withAlpha(pal.curve, 0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    curve.pts.forEach(([u, v], k) => (k ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))));
    ctx.stroke();
    ctx.strokeStyle = pal.curve;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    curve.pts.slice(0, Math.max(1, curve.upto) + 1).forEach(([u, v], k) => (k ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))));
    ctx.stroke();
  }
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.arc(X(point[0]), Y(point[1]), 3.5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.font = `12px ${pal.fontUi}`;
  ctx.fillStyle = pal.ink2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(s.names[0], box.x + box.w / 2, box.y + box.h + 3);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.names[1], box.x - 4, box.y + box.h / 2);
  ctx.restore();
}
