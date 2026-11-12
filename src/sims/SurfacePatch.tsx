/**
 * Lessons 3.1–3.5: a parametrized surface σ(u, v) with its parameter grid, in an orthographic view the reader turns by
 * dragging (or with the arrow keys), and a point σ(u, v) moved by two sliders. Layers: the partial derivatives σ_u
 * (filled head) and σ_v (open head); the two parameter curves through the point; the tangent plane (drawn in the
 * colour of N̂, the vector it is perpendicular to); the unit normal N̂ (violet, barred head); N̂ carried along the
 * curve v = 0 from u = 0 to the point (the Möbius band's loop); the parameter domain as an inset; a curve of the
 * domain and its image, with its length from the first form. Toggles: swap the parameters (the same surface, the
 * opposite normal: the two side colours swap). A bending slider for the families `roll` and `cone-roll` (every
 * member isometric to the flat one).
 *
 * The two sides of the surface have two colours: the side N̂ points out of, and the other one (core/mesh.ts).
 * Every number comes from src/math/surfaces.ts with exact partial derivatives; the picture is evidence, not proof.
 *
 * Presets: SURFACES3 (plane, plane-oblique, plane-polar, sphere, sphere-colat, sphere-graph, cylinder, cone, torus,
 * catenoid, hyperboloid, saddle, saddle-xy, mobius, roll, cone-roll); curves: DOMAIN_CURVES.
 * Tasks (each ticks only on the reader's own move: a slider, a toggle, a drag; never on a text step or on choosing a
 * surface): pole, vertex, polar-origin, torus-inner, swap, mobius-loop, edge-on, orthogonal, curve-full, bend-full.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  DOMAIN_CURVES,
  SURFACES3,
  efg,
  lengthInDomain,
  lengthOnSurface,
  regularity,
  swapped,
  unitNormal3,
  type DomainCurve,
  type SurfaceDef,
} from '~/math/surfaces';
import { cross3, dot3, len3, scale3, type Vec3 } from '~/math/vec';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { sci } from './core/format';
import { drawDomainInset, drawSurface, sampleSurface } from './core/mesh';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import { arrow3, axisTriad, bounds, camBasis, curve3, label3, makeProjector, orbitHandlers, planePatch, tag, type Cam } from './core/space';

export type PatchLayer = 'grid' | 'partials' | 'coord-lines' | 'tangent-plane' | 'normal' | 'transport' | 'domain' | 'form';

const LAYER_LABEL: Record<PatchLayer, string> = {
  grid: 'רשת הפרמטרים',
  partials: 'σᵤ ו-σᵥ',
  'coord-lines': 'הקווים הפרמטריים בנקודה',
  'tangent-plane': 'המישור המשיק',
  normal: 'הנורמל N̂',
  transport: 'N̂ לאורך v = 0',
  domain: 'תחום הפרמטרים',
  form: 'E, F, G',
};

const TASK_LABEL: Record<string, string> = {
  pole: 'בספרה, הזיזו את הנקודה אל הקוטב. מה קורה ל-σᵤ ול-‖σᵤ × σᵥ‖?',
  vertex: 'בחרוט הכפול, הזיזו את הנקודה אל הקודקוד. מה קורה ל-‖σᵤ × σᵥ‖?',
  'polar-origin': 'בקואורדינטות הקוטביות, הזיזו את הנקודה אל הראשית. האם המישור עצמו משתנה שם?',
  'torus-inner': 'בטורוס, הזיזו את הנקודה אל קו המשווה הפנימי. איפה ‖σᵤ × σᵥ‖ הכי קטן?',
  swap: 'עם הנורמל מוצג, הפעילו את החלפת סדר הפרמטרים. מה קרה ל-N̂ ולצבעי שני הצדדים?',
  'mobius-loop': 'ברצועת מביוס, עם N̂ לאורך v = 0, הזיזו את u מ-0 עד 2π. לאן מצביע N̂ כשחוזרים לאותה נקודה?',
  'edge-on': 'סובבו את המבט (גררו את האיור) עד שהמישור המשיק נראה כקו ישר.',
  orthogonal: 'באוכף, מצאו נקודה שבה הקווים הפרמטריים ניצבים זה לזה (cos θ = 0).',
  'curve-full': 'הזיזו את סוף המסילה עד הסוף, והשוו את האורך על המשטח לאורך בתחום הפרמטרים.',
  'bend-full': 'הזיזו את מחוון הגלגול עד הסוף. מה קרה לצורת המסילה, ומה לאורך שלה?',
};

const N = 240;
const NC = 300;
const NB = 100;
const fmt = (v: number, sig = 3) => (Number.isFinite(v) ? sci(Math.round(v * 1e9) / 1e9, sig).replace(/^-/, '−') : '—');

interface State {
  surface: string;
  iu: number;
  iv: number;
  show: PatchLayer[];
  swap: boolean;
  curve: string | null;
  /** how much of the curve is drawn, 0..NC */
  ic: number;
  /** bending, 0..NB */
  ib: number;
}

export interface SurfacePatchProps {
  id: string;
  surface?: string;
  /** surfaces offered as toggles */
  surfaces?: string[];
  /** the initial point, in the surface's own parameters (snapped to the sliders' grid) */
  u?: number;
  v?: number;
  show?: PatchLayer[];
  /** layers the reader may toggle */
  layers?: PatchLayer[];
  /** offer the "swap the parameters" toggle */
  swap?: boolean;
  /** the domain curve shown at first (an id in DOMAIN_CURVES[surface]) */
  curve?: string;
  /** initial bending λ ∈ [0, 1] for the families */
  bend?: number;
  yaw?: number;
  pitch?: number;
  tasks?: string[];
}

const baseOf = (id: string): SurfaceDef => SURFACES3[id] ?? SURFACES3.sphere;
const uOf = (s: SurfaceDef, i: number) => s.u0 + ((s.u1 - s.u0) * i) / N;
const vOf = (s: SurfaceDef, j: number) => s.v0 + ((s.v1 - s.v0) * j) / N;
const iuOf = (s: SurfaceDef, u: number) => Math.max(0, Math.min(N, Math.round(((u - s.u0) / (s.u1 - s.u0)) * N)));
const ivOf = (s: SurfaceDef, v: number) => Math.max(0, Math.min(N, Math.round(((v - s.v0) / (s.v1 - s.v0)) * N)));
const curvesOf = (id: string): DomainCurve[] => DOMAIN_CURVES[id] ?? [];

/** The surface as the reader sees it: the bending applied (in the surface's own parameters). */
function bentOf(st: State): SurfaceDef {
  const b = baseOf(st.surface);
  return b.family ? b.family(st.ib / NB) : b;
}

function fresh(p: SurfacePatchProps): State {
  const s = baseOf(p.surface ?? 'sphere');
  const cs = curvesOf(s.id);
  return {
    surface: s.id,
    iu: iuOf(s, p.u ?? (s.u0 + s.u1) / 2),
    iv: ivOf(s, p.v ?? (s.v0 + s.v1) / 2),
    show: p.show ?? ['grid'],
    swap: false,
    curve: p.curve && cs.some((c) => c.id === p.curve) ? p.curve : null,
    ic: NC,
    ib: Math.round((p.bend ?? 0) * NB),
  };
}

/** Values at the current point, in the parameters of the effective (possibly swapped) parametrization. */
function probe(st: State) {
  const s = bentOf(st);
  const u = uOf(s, st.iu);
  const v = vOf(s, st.iv);
  const eff = st.swap ? swapped(s) : s;
  const [a, b] = st.swap ? [v, u] : [u, v];
  const reg = regularity(eff, a, b);
  const nrm = unitNormal3(eff, a, b);
  const f = efg(eff, a, b);
  return { s, eff, u, v, a, b, p: s.p(u, v), su: eff.su(a, b), sv: eff.sv(a, b), reg, nrm, ...f };
}

export default function SurfacePatch(props: SurfacePatchProps) {
  const [st, setSt] = useState<State>(() => fresh(props));
  const [cam, setCam] = useState<Cam>({ yaw: props.yaw ?? 0.9, pitch: props.pitch ?? 0.35 });
  const camRef = useRef(cam);
  camRef.current = cam;
  const [live, setLive] = useState('');
  const seen = useRef({ lo: false, hi: false });
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t);
  const tick = (t: string) => markTask(`${props.id}:${t}`);
  const q = probe(st);
  const on = (l: PatchLayer) => st.show.includes(l);
  const base = baseOf(st.surface);
  const curve = st.curve ? curvesOf(st.surface).find((c) => c.id === st.curve) ?? null : null;

  // the scene's bounding ball: for a family, the union over the bending range, so the scale stays put while bending
  const geom = useMemo(() => {
    const members = base.family ? [0, 0.5, 1].map((l) => base.family!(l)) : [base];
    const pts: Vec3[] = [];
    let ref = 0;
    for (const m of members) {
      for (const row of sampleSurface(m, 24, 12)) pts.push(...row);
      for (let i = 0; i <= 12; i++)
        for (let j = 0; j <= 12; j++) {
          const u = m.u0 + ((m.u1 - m.u0) * i) / 12;
          const v = m.v0 + ((m.v1 - m.v0) * j) / 12;
          ref = Math.max(ref, len3(m.su(u, v)), len3(m.sv(u, v)));
        }
    }
    return { ball: bounds(pts), ref: Math.max(ref, 1e-9) };
  }, [st.surface]);

  const curvePts = useMemo(() => {
    if (!curve) return null;
    const dom: [number, number][] = [];
    for (let k = 0; k <= NC; k++) dom.push(curve.c(curve.t0 + ((curve.t1 - curve.t0) * k) / NC));
    return dom;
  }, [st.surface, st.curve]);
  const tEnd = curve ? curve.t0 + ((curve.t1 - curve.t0) * st.ic) / NC : 0;
  const lenS = curve ? lengthOnSurface(q.s, curve, curve.t0, tEnd, 400) : NaN;
  const lenD = curve ? lengthInDomain(curve, curve.t0, tEnd, 400) : NaN;

  /** The reader's own change. A text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...st, ...patch };
    setSt(next);
    if (patch.surface !== undefined) {
      seen.current = { lo: false, hi: false };
      return;
    }
    const r = probe(next);
    const moved = (patch.iu !== undefined && patch.iu !== st.iu) || (patch.iv !== undefined && patch.iv !== st.iv);
    if (moved) {
      if (has('pole') && next.surface === 'sphere' && Math.abs(r.v) > 1.55) tick('pole');
      if (has('vertex') && next.surface === 'cone' && Math.abs(r.v) < 0.03) tick('vertex');
      if (has('polar-origin') && next.surface === 'plane-polar' && r.u < 0.03) tick('polar-origin');
      if (has('torus-inner') && next.surface === 'torus' && Math.abs(r.v - Math.PI) < 0.06) tick('torus-inner');
      if (has('orthogonal') && next.surface.startsWith('saddle') && Math.abs(r.F) / Math.sqrt(r.E * r.G) < 0.02) tick('orthogonal');
      if (next.surface === 'mobius' && (next.show.includes('transport') || next.show.includes('normal'))) {
        if (r.u < 0.3) seen.current.lo = true;
        if (r.u > 2 * Math.PI - 0.3) seen.current.hi = true;
        if (has('mobius-loop') && seen.current.lo && seen.current.hi) tick('mobius-loop');
      }
    }
    if (has('swap') && patch.swap === true && next.show.includes('normal')) tick('swap');
    if (has('curve-full') && patch.ic !== undefined && patch.ic !== st.ic && patch.ic >= NC) tick('curve-full');
    if (has('bend-full') && patch.ib !== undefined && patch.ib !== st.ib && patch.ib >= NB - 1 && next.curve) tick('bend-full');
  };

  const userCam = (c: Cam) => {
    setCam(c);
    const { eye } = camBasis(c);
    if (has('edge-on') && on('tangent-plane') && q.nrm && Math.abs(dot3(eye, q.nrm)) < Math.sin((8 * Math.PI) / 180)) tick('edge-on');
  };
  const orbitH = orbitHandlers(() => camRef.current, userCam);

  useEffect(
    () =>
      subscribeSteps(props.id, (o) => {
        setSt((prev) => {
          const next = { ...prev };
          if (typeof o.surface === 'string' && o.surface in SURFACES3) {
            next.surface = o.surface;
            if (o.curve === undefined) next.curve = null;
          }
          const s = baseOf(next.surface);
          if (typeof o.u === 'number') next.iu = iuOf(s, o.u);
          else if (o.surface !== undefined) next.iu = iuOf(s, (s.u0 + s.u1) / 2);
          if (typeof o.v === 'number') next.iv = ivOf(s, o.v);
          else if (o.surface !== undefined) next.iv = ivOf(s, (s.v0 + s.v1) / 2);
          if (Array.isArray(o.show)) next.show = o.show as PatchLayer[];
          if (typeof o.swap === 'boolean') next.swap = o.swap;
          if (o.curve === null || typeof o.curve === 'string') next.curve = o.curve && curvesOf(next.surface).some((c) => c.id === o.curve) ? (o.curve as string) : null;
          if (typeof o.upto === 'number') next.ic = Math.round(Math.max(0, Math.min(1, o.upto)) * NC);
          else if (o.curve !== undefined) next.ic = NC;
          if (typeof o.bend === 'number') next.ib = Math.round(Math.max(0, Math.min(1, o.bend)) * NB);
          return next;
        });
        if (typeof o.yaw === 'number' || typeof o.pitch === 'number')
          setCam((c) => ({ yaw: typeof o.yaw === 'number' ? o.yaw : c.yaw, pitch: typeof o.pitch === 'number' ? o.pitch : c.pitch }));
      }),
    [props.id],
  );

  const [n1, n2] = q.eff.names;
  const describe = () => {
    const head = `${base.label}, ${base.formula}${st.swap ? ', עם סדר הפרמטרים מוחלף' : ''}${base.family ? `, גלגול λ = ${fmt(st.ib / NB, 2)}` : ''}. `;
    const pt = `הנקודה ${n1} = ${fmt(q.a)}, ${n2} = ${fmt(q.b)}. `;
    const reg = q.nrm ? `‖σ${n1} × σ${n2}‖ = ${fmt(q.reg)}, הפרמטריזציה רגולרית כאן. ` : `‖σ${n1} × σ${n2}‖ = 0: הפרמטריזציה אינה רגולרית כאן. `;
    const nn = q.nrm && on('normal') ? `N̂ = (${q.nrm.map((x) => fmt(x, 2)).join(', ')}). ` : '';
    const ff = on('form') ? `E = ${fmt(q.E)}, F = ${fmt(q.F)}, G = ${fmt(q.G)}. ` : '';
    const cc = curve ? `המסילה ${curve.formula}: אורך על המשטח ${fmt(lenS)}, אורך בתחום הפרמטרים ${fmt(lenD)}.` : '';
    return head + pt + reg + nn + ff + cc;
  };

  useEffect(() => {
    const id = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(id);
  }, [st]);

  const draw = ({ ctx, view, palette: pal }: FrameInfo) => {
    const { ball, ref } = geom;
    const P = makeProjector(cam, ball.centre, ball.radius, view.w, view.h, 0.8);
    const s = q.s;
    drawSurface(ctx, P, pal, q.eff, {
      front: pal.hand,
      back: pal.accent,
      grid: on('grid'),
      nu: s.id === 'torus' || s.id === 'mobius' ? 72 : 60,
      nv: s.id === 'torus' ? 36 : 28,
    });

    const p = q.p;
    const L = 0.38 * ball.radius;
    const k = (0.32 * ball.radius) / ref;

    if (on('tangent-plane') && q.nrm) {
      const e1 = scale3(q.su, 1 / Math.max(1e-12, len3(q.su)));
      const e2 = cross3(q.nrm, e1);
      planePatch(ctx, P, p, e1, e2, 0.42 * ball.radius, pal.surfaceNormal, 0.16);
    }

    if (curve && curvePts) {
      const all = curvePts.map(([u, v]) => s.p(u, v));
      curve3(ctx, P, all, pal.ink3, 1.6, 0.25);
      if (st.ic > 0) curve3(ctx, P, all.slice(0, st.ic + 1), pal.curve, 3, 0.45);
    }

    if (on('coord-lines')) {
      const lu: Vec3[] = [];
      const lv: Vec3[] = [];
      for (let i = 0; i <= 160; i++) {
        lu.push(s.p(s.u0 + ((s.u1 - s.u0) * i) / 160, q.v));
        lv.push(s.p(q.u, s.v0 + ((s.v1 - s.v0) * i) / 160));
      }
      curve3(ctx, P, lu, pal.tangent, 2.2, 0.35);
      curve3(ctx, P, lv, pal.hand, 2.2, 0.35);
    }

    if (on('transport') && s.id === 'mobius') {
      // one arrow every π/6 of u, from u = 0 up to the point
      const steps = Math.max(1, Math.round(q.u / (Math.PI / 6)));
      const uMax = q.u;
      for (let m = 0; m <= steps; m++) {
        const uu = (uMax * m) / steps;
        const n = unitNormal3(s, uu, 0);
        if (!n) continue;
        arrow3(ctx, P, s.p(uu, 0), scale3(n, 0.7 * L), m === 0 ? pal.ink2 : pal.surfaceNormal, 'bar', 1.4);
      }
      const n0 = unitNormal3(s, 0, 0)!;
      label3(ctx, pal, P, s.p(0, 0), scale3(n0, 0.7 * L), 'N̂(0, 0)', pal.ink2, 18);
    }

    if (on('partials')) {
      const A = scale3(q.su, k);
      const B = scale3(q.sv, k);
      if (len3(q.su) > 1e-9) {
        arrow3(ctx, P, p, A, pal.tangent, 'fill');
        label3(ctx, pal, P, p, A, `σ${n1}`, pal.tangent);
      }
      if (len3(q.sv) > 1e-9) {
        arrow3(ctx, P, p, B, pal.hand, 'open');
        label3(ctx, pal, P, p, B, `σ${n2}`, pal.hand);
      }
    }
    if (on('normal') && q.nrm) {
      const Nv = scale3(q.nrm, L);
      arrow3(ctx, P, p, Nv, pal.surfaceNormal, 'bar', 2.8);
      label3(ctx, pal, P, p, Nv, 'N̂', pal.surfaceNormal);
    }

    const [x, y] = P(p);
    ctx.save();
    ctx.fillStyle = pal.ink;
    ctx.strokeStyle = pal.paper;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (!q.nrm) tag(ctx, pal, `‖σ${n1} × σ${n2}‖ = 0`, x, y + 24, pal.ink2, 13);

    if (on('domain')) {
      // smaller on a phone, where the inset would otherwise cover the top of the surface
      const w = view.w < 480 ? Math.min(96, view.w * 0.24) : Math.min(130, view.w * 0.3);
      const h = w * 0.7;
      const sEff = q.eff;
      const curveDom = curve && curvePts ? { pts: curvePts.map(([u, v]) => (st.swap ? [v, u] : [u, v]) as [number, number]), upto: st.ic } : undefined;
      drawDomainInset(ctx, pal, sEff, { x: 30, y: 14, w, h }, [q.a, q.b], curveDom);
    }
    axisTriad(ctx, pal, cam, 40, view.h - 40);
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 4, worldHeight: 3, animate: false });
  useEffect(invalidate, [st, cam, geom]);

  const surfaces = props.surfaces ?? [];
  const layers = props.layers ?? [];
  const curves = curvesOf(st.surface);
  const toggleLayer = (l: PatchLayer) => userSet({ show: on(l) ? st.show.filter((x) => x !== l) : [...st.show, l] });
  const cosT = q.F / Math.sqrt(q.E * q.G);

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: משטח בפרמטריזציה עם רשת הפרמטרים ונקודה עליו, במבט שאפשר לסובב. ${describe()} גררו כדי לסובב את המבט; במקלדת: חיצים.`}
      canvasRef={canvasRef}
      aspect={4 / 3}
      live={live}
      tasks={tasks}
      cursor="grab"
      onKeyDown={orbitH.onKeyDown}
      onPointerDown={orbitH.onPointerDown}
      onPointerMove={orbitH.onPointerMove}
      onPointerUp={orbitH.onPointerUp}
      onReset={() => {
        setSt(fresh(props));
        setCam({ yaw: props.yaw ?? 0.9, pitch: props.pitch ?? 0.35 });
        seen.current = { lo: false, hi: false };
        setLive('האיור אופס.');
      }}
      readout={
        <>
          <span data-readout="point">
            <bdi dir="ltr">({n1}, {n2}) = ({fmt(q.a)}, {fmt(q.b)})</bdi>
          </span>
          <span data-readout="regularity">
            {q.nrm ? (
              <bdi dir="ltr"><b class="q">‖σ{n1} × σ{n2}‖ = {fmt(q.reg)}</b></bdi>
            ) : (
              <>לא רגולרית כאן: <bdi dir="ltr"><b class="q">‖σ{n1} × σ{n2}‖ = 0</b></bdi></>
            )}
          </span>
          {on('normal') && q.nrm && (
            <span data-readout="normal">
              <bdi dir="ltr">N̂ = ({q.nrm.map((x) => fmt(x, 2)).join(', ')})</bdi>
            </span>
          )}
          {on('form') && (
            <span data-readout="form">
              <bdi dir="ltr">E = {fmt(q.E)}, F = {fmt(q.F)}, G = {fmt(q.G)}</bdi>
              {q.nrm && (
                <>
                  {' '}· הזווית בין הקווים הפרמטריים <bdi dir="ltr"><b class="q">cos θ = F/√(EG) = {fmt(cosT)}</b></bdi>
                </>
              )}
            </span>
          )}
          {curve && (
            <span data-readout="length">
              אורך על המשטח <bdi dir="ltr"><b class="q">∫√(E u′² + 2F u′v′ + G v′²) dt = {fmt(lenS, 4)}</b></bdi>
              {' '}· אורך בתחום הפרמטרים <bdi dir="ltr">{fmt(lenD, 4)}</bdi>
            </span>
          )}
        </>
      }
      controls={
        <>
          {surfaces.length > 1 && (
            <div class="group" role="group" aria-label="המשטח">
              {surfaces.map((id) => (
                <Toggle
                  key={id}
                  label={baseOf(id).label}
                  on={st.surface === id}
                  onChange={() => {
                    const s = baseOf(id);
                    userSet({ surface: id, iu: iuOf(s, (s.u0 + s.u1) / 2), iv: ivOf(s, (s.v0 + s.v1) / 2), curve: null, ic: NC, ib: 0 });
                  }}
                />
              ))}
            </div>
          )}
          <Slider label={`הפרמטר ${base.names[0]}`} value={st.iu} min={0} max={N} step={1} format={(i) => fmt(uOf(q.s, i))} onChange={(i) => userSet({ iu: Math.round(i) })} />
          <Slider label={`הפרמטר ${base.names[1]}`} value={st.iv} min={0} max={N} step={1} format={(j) => fmt(vOf(q.s, j))} onChange={(j) => userSet({ iv: Math.round(j) })} />
          {base.family && (
            <Slider label={base.familyLabel ?? 'λ'} value={st.ib} min={0} max={NB} step={1} format={(b) => fmt(b / NB, 2)} onChange={(b) => userSet({ ib: Math.round(b) })} />
          )}
          {curves.length > 0 && (
            <div class="group" role="group" aria-label="מסילה על המשטח">
              {curves.map((c) => (
                <Toggle key={c.id} label={c.label} on={st.curve === c.id} onChange={(v) => userSet({ curve: v ? c.id : null, ic: NC })} />
              ))}
            </div>
          )}
          {curve && (
            <Slider label="סוף המסילה t" value={st.ic} min={0} max={NC} step={1} format={(i) => fmt(curve.t0 + ((curve.t1 - curve.t0) * i) / NC)} onChange={(i) => userSet({ ic: Math.round(i) })} />
          )}
          {(layers.length > 0 || props.swap) && (
            <div class="group" role="group" aria-label="שכבות">
              {layers.map((l) => (
                <Toggle key={l} label={LAYER_LABEL[l]} on={on(l)} onChange={() => toggleLayer(l)} />
              ))}
              {props.swap && <Toggle label="החלפת סדר הפרמטרים" on={st.swap} onChange={(v) => userSet({ swap: v })} />}
            </div>
          )}
        </>
      }
    />
  );
}
