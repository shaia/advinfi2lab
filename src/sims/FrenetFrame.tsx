/**
 * Lessons 2.1–2.3 and 2.5: a space curve and its Frenet frame at a moving point, in an orthographic view the reader
 * turns by dragging (or with the arrow keys). Layers: the frame t (filled head), n (open head), b (barred head); the
 * osculating plane (⊥ b, drawn in the binormal colour), the normal plane (⊥ t, tangent colour), the rectifying plane
 * (⊥ n, normal colour); the osculating circle; the Darboux vector ω = τt + κb; the axis of a helix or of a
 * generalized helix; the sphere a spherical curve lies on, with the osculating sphere. Toggles reverse the curve and
 * reflect it in the plane z = 0.
 *
 * Every number comes from src/math/spacecurves.ts with exact derivatives; the picture is evidence, not proof.
 *
 * Presets: helix, helix-left, helix-fast, cubic, glued, planar-cubic, planar, saddle, cylinder-helix, viviani (SPACE_CURVES).
 * Tasks (each ticks only on the reader's own move: a slider, a toggle, a drag; never on a text step or on choosing a
 * curve): jump, edge-on, top-view, mirror, reverse, planar-zero, saddle-sign, cubic-max, darboux-helix, fast-same,
 * helix-angle, viviani-sphere.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  SPACE_CURVES,
  darboux,
  frame,
  kappa,
  mirrored,
  osculatingSphere,
  reversed,
  tau,
  type SpaceCurve,
} from '~/math/spacecurves';
import { add3, dot3, len3, scale3, type Vec3 } from '~/math/vec';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import {
  arrow3,
  axisTriad,
  bounds,
  camBasis,
  circle3,
  curve3,
  label3,
  makeProjector,
  orbitHandlers,
  planePatch,
  sphere3,
  tag,
  type Cam,
} from './core/space';

export type FrameLayer = 'frame' | 'osculating' | 'normal-plane' | 'rectifying' | 'circle' | 'darboux' | 'axis' | 'sphere';

const LAYER_LABEL: Record<FrameLayer, string> = {
  frame: 'השלשה t, n, b',
  osculating: 'המישור המנשק',
  'normal-plane': 'המישור הנורמלי',
  rectifying: 'המישור המיישר',
  circle: 'המעגל המנשק',
  darboux: 'וקטור דרבו ω',
  axis: 'הציר',
  sphere: 'הספרה',
};

const TASK_LABEL: Record<string, string> = {
  jump: 'במסילה המודבקת, הזיזו את הנקודה מצד אחד של t = 0 לצד השני. מה קורה ל-n ול-b?',
  'edge-on': 'סובבו את המבט (גררו את האיור) עד שהמישור המנשק נראה כקו ישר. איך נראית המסילה ליד הנקודה?',
  'top-view': 'בסליל, סובבו את המבט עד שאתם מסתכלים לאורך הציר. לאן מצביע n?',
  mirror: 'הפעילו את השיקוף במסילה שאינה מישורית. מה קרה לסימן של τ, ומה ל-κ?',
  reverse: 'הפעילו את היפוך הכיוון. אילו מהווקטורים t, n, b התהפכו, ומה קרה ל-τ?',
  'planar-zero': 'במסילה המישורית הנטויה, הזיזו את הנקודה ובדקו את τ ואת b.',
  'saddle-sign': 'במסילה על האוכף, מצאו נקודה עם τ חיובי ונקודה עם τ שלילי.',
  'cubic-max': 'במסילה המעוקבת, מצאו את הנקודה שבה הפיתול מקסימלי.',
  'darboux-helix': 'בסליל, עם וקטור דרבו מוצג, הזיזו את הנקודה. מה נשאר קבוע ב-ω?',
  'fast-same': 'עברו לסליל המהיר והזיזו את הנקודה. השוו את κ ואת τ לסליל הרגיל.',
  'helix-angle': 'בסליל המוכלל מעל השרשרת, עם הציר מוצג, הזיזו את הנקודה רחוק. מה קורה לזווית בין t לציר, ולמנה τ/κ?',
  'viviani-sphere': 'במסילה של ויויאני, עם הספרה מוצגת, הזיזו את הנקודה. מה קורה לרדיוס של הספרה המנשקת?',
};

const N = 600;
const fmt = (v: number, sig = 3) => (Number.isFinite(v) ? sci(Math.round(v * 1e9) / 1e9, sig).replace(/^-/, '−') : '—');

interface State {
  curve: string;
  i: number;
  show: FrameLayer[];
  reverse: boolean;
  mirror: boolean;
}

export interface FrenetFrameProps {
  id: string;
  curve?: string;
  /** curves offered as toggles */
  curves?: string[];
  /** initial parameter value t (snapped to the slider's grid) */
  t?: number;
  /** layers shown at first */
  show?: FrameLayer[];
  /** layers the reader may toggle */
  layers?: FrameLayer[];
  /** offer "reverse" and "mirror" toggles */
  transforms?: boolean;
  /** hide the torsion readout (lesson 2.1 comes before torsion is defined) */
  noTorsion?: boolean;
  yaw?: number;
  pitch?: number;
  tasks?: string[];
}

const curveOf = (id: string) => SPACE_CURVES[id] ?? SPACE_CURVES.helix;
const tOf = (c: SpaceCurve, i: number) => c.a + ((c.b - c.a) * i) / N;
const iOf = (c: SpaceCurve, t: number) => Math.max(0, Math.min(N, Math.round(((t - c.a) / (c.b - c.a)) * N)));

function effective(s: State): SpaceCurve {
  let c = curveOf(s.curve);
  if (s.reverse) c = reversed(c);
  if (s.mirror) c = mirrored(c);
  return c;
}

function fresh(p: FrenetFrameProps): State {
  const c = curveOf(p.curve ?? 'helix');
  return { curve: c.id, i: iOf(c, p.t ?? (c.a + c.b) / 2), show: p.show ?? ['frame'], reverse: false, mirror: false };
}

/** Values at the current point. */
function probe(s: State) {
  const c = effective(s);
  const t = tOf(c, s.i);
  const k = kappa(c, t);
  const F = frame(c, t);
  const w = F ? tau(c, t) : NaN;
  return { c, t, k, F, w, p: c.p(t) };
}

export default function FrenetFrame(props: FrenetFrameProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [cam, setCam] = useState<Cam>({ yaw: props.yaw ?? 0.9, pitch: props.pitch ?? 0.35 });
  const camRef = useRef(cam);
  camRef.current = cam;
  const [live, setLive] = useState('');
  const seen = useRef({ side: 0, pos: false, neg: false, angleTs: [] as number[] });
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const q = probe(s);
  const has = (t: string) => props.tasks?.includes(t);
  const tick = (t: string) => markTask(`${props.id}:${t}`);

  const pts = useMemo(() => {
    const c = effective(s);
    return Array.from({ length: N + 1 }, (_, j) => c.p(tOf(c, j)));
  }, [s.curve, s.reverse, s.mirror]);
  const ball = useMemo(() => {
    const c = effective(s);
    const extra: Vec3[] = c.sphere ? [add3(c.sphere.centre, [c.sphere.radius, 0, 0]), add3(c.sphere.centre, [-c.sphere.radius, 0, 0]), add3(c.sphere.centre, [0, 0, c.sphere.radius]), add3(c.sphere.centre, [0, 0, -c.sphere.radius])] : [];
    return bounds([...pts, ...extra]);
  }, [pts]);

  /** The reader's own change. A text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const r = probe(next);
    // the reader moved the point along the same curve (choosing a curve or reversing it also sets i, and must not count)
    const moved = patch.i !== undefined && patch.curve === undefined && patch.reverse === undefined && patch.i !== s.i;
    if (moved && next.curve === 'glued') {
      const side = Math.sign(r.t);
      if (has('jump') && side !== 0 && seen.current.side !== 0 && side !== seen.current.side) tick('jump');
      if (side !== 0) seen.current.side = side;
    }
    if (patch.curve !== undefined) seen.current = { side: 0, pos: false, neg: false, angleTs: [] };
    if (has('mirror') && patch.mirror === true && !curveOf(next.curve).plane) tick('mirror');
    if (has('reverse') && patch.reverse === true) tick('reverse');
    if (has('planar-zero') && moved && next.curve === 'planar') tick('planar-zero');
    if (moved && next.curve === 'saddle') {
      if (r.w > 0.05) seen.current.pos = true;
      if (r.w < -0.05) seen.current.neg = true;
      if (has('saddle-sign') && seen.current.pos && seen.current.neg) tick('saddle-sign');
    }
    if (has('cubic-max') && moved && next.curve === 'cubic' && r.w > 2.99) tick('cubic-max');
    if (has('darboux-helix') && moved && next.curve === 'helix' && next.show.includes('darboux')) tick('darboux-helix');
    if (has('fast-same') && moved && next.curve === 'helix-fast') tick('fast-same');
    if (moved && next.curve === 'cylinder-helix' && next.show.includes('axis')) {
      seen.current.angleTs.push(r.t);
      const ts = seen.current.angleTs;
      if (has('helix-angle') && Math.max(...ts) - Math.min(...ts) > 1) tick('helix-angle');
    }
    if (has('viviani-sphere') && moved && next.curve === 'viviani' && next.show.includes('sphere')) tick('viviani-sphere');
  };

  const userCam = (c: Cam) => {
    setCam(c);
    const { eye } = camBasis(c);
    if (has('edge-on') && s.show.includes('osculating') && q.F && Math.abs(dot3(eye, q.F.b)) < Math.sin((8 * Math.PI) / 180)) tick('edge-on');
    if (has('top-view') && s.curve.startsWith('helix') && Math.abs(eye[2]) > Math.cos((12 * Math.PI) / 180)) tick('top-view');
  };
  const orbitH = orbitHandlers(() => camRef.current, userCam);

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.curve === 'string' && st.curve in SPACE_CURVES) next.curve = st.curve;
          const c = curveOf(next.curve);
          if (typeof st.t === 'number') next.i = iOf(c, st.t);
          else if (st.curve !== undefined) next.i = iOf(c, (c.a + c.b) / 2);
          if (Array.isArray(st.show)) next.show = st.show as FrameLayer[];
          if (typeof st.reverse === 'boolean') next.reverse = st.reverse;
          if (typeof st.mirror === 'boolean') next.mirror = st.mirror;
          return next;
        });
        if (typeof st.yaw === 'number' || typeof st.pitch === 'number')
          setCam((c) => ({ yaw: typeof st.yaw === 'number' ? st.yaw : c.yaw, pitch: typeof st.pitch === 'number' ? st.pitch : c.pitch }));
      }),
    [props.id],
  );

  const on = (l: FrameLayer) => s.show.includes(l);
  const osc = on('sphere') ? osculatingSphere(q.c, q.t) : null;
  const omega = on('darboux') ? darboux(q.c, q.t) : null;
  const axisAngle = q.c.axis ? (Math.acos(Math.max(-1, Math.min(1, dot3(scale3(q.c.d1(q.t), 1 / len3(q.c.d1(q.t))), q.c.axis.dir)))) * 180) / Math.PI : NaN;

  const describe = () => {
    const base = `${q.c.label} ${q.c.formula}${s.reverse ? ', בכיוון הפוך' : ''}${s.mirror ? ', אחרי שיקוף במישור z = 0' : ''}. הנקודה t = ${fmt(q.t)}. `;
    if (!q.F) return `${base}כאן העקמומיות אפס: הנורמל והבינורמל${props.noTorsion ? '' : ' והפיתול'} אינם מוגדרים.`;
    return `${base}העקמומיות κ = ${fmt(q.k)}${props.noTorsion ? '' : `, הפיתול τ = ${fmt(q.w)}`}. t = (${q.F.t.map((x) => fmt(x, 2)).join(', ')}), n = (${q.F.n.map((x) => fmt(x, 2)).join(', ')}), b = (${q.F.b.map((x) => fmt(x, 2)).join(', ')}).`;
  };

  useEffect(() => {
    const id = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(id);
  }, [s]);

  const draw = ({ ctx, view, palette: pal }: FrameInfo) => {
    const P = makeProjector(cam, ball.centre, ball.radius, view.w, view.h, 0.84);
    const L = 0.42 * ball.radius;
    const { p, F, k } = q;

    if (on('sphere') && q.c.sphere) sphere3(ctx, P, q.c.sphere.centre, q.c.sphere.radius, pal.ink3);
    if (on('axis') && q.c.axis) {
      const a = q.c.axis;
      const A = P(add3(a.point, scale3(a.dir, -1.6 * ball.radius)));
      const B = P(add3(a.point, scale3(a.dir, 1.6 * ball.radius)));
      ctx.save();
      ctx.strokeStyle = pal.ink3;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(B[0], B[1]);
      ctx.stroke();
      ctx.restore();
    }
    if (F) {
      if (on('normal-plane')) planePatch(ctx, P, p, F.n, F.b, 0.45 * ball.radius, pal.tangent);
      if (on('rectifying')) planePatch(ctx, P, p, F.t, F.b, 0.45 * ball.radius, pal.normal);
      if (on('osculating')) planePatch(ctx, P, p, F.t, F.n, 0.45 * ball.radius, pal.binormal);
    }

    curve3(ctx, P, pts, pal.curve, 2.6);
    // orientation chevrons along the curve
    for (const f of [0.2, 0.5, 0.8]) {
      const j = Math.round(f * N);
      const a = P(pts[j]);
      const b = P(pts[j + 1]);
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy);
      if (l < 1e-6) continue;
      const ux = dx / l;
      const uy = dy / l;
      ctx.save();
      ctx.strokeStyle = withAlpha(pal.curve, 0.8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a[0] - ux * 7 - uy * 5, a[1] - uy * 7 + ux * 5);
      ctx.lineTo(a[0], a[1]);
      ctx.lineTo(a[0] - ux * 7 + uy * 5, a[1] - uy * 7 - ux * 5);
      ctx.stroke();
      ctx.restore();
    }

    if (F && on('circle')) {
      const C = add3(p, scale3(F.n, 1 / k));
      circle3(ctx, P, C, F.t, F.n, 1 / k, pal.hand, 1.8, [6, 4]);
    }
    if (osc) {
      const [x, y] = P(osc.centre);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, osc.radius * P.scale, 0, 2 * Math.PI);
      ctx.strokeStyle = pal.hand;
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    if (F && on('frame')) {
      arrow3(ctx, P, p, scale3(F.b, L), pal.binormal, 'bar');
      arrow3(ctx, P, p, scale3(F.n, L), pal.normal, 'open');
      arrow3(ctx, P, p, scale3(F.t, L), pal.tangent, 'fill');
      label3(ctx, pal, P, p, scale3(F.t, L), 't', pal.tangent);
      label3(ctx, pal, P, p, scale3(F.n, L), 'n', pal.normal);
      label3(ctx, pal, P, p, scale3(F.b, L), 'b', pal.binormal);
    } else if (!F && on('frame')) {
      const T = scale3(q.c.d1(q.t), L / len3(q.c.d1(q.t)));
      arrow3(ctx, P, p, T, pal.tangent, 'fill');
      label3(ctx, pal, P, p, T, 't', pal.tangent);
      const [x, y] = P(p);
      tag(ctx, pal, 'κ = 0', x, y + 26, pal.ink2, 13);
    }
    if (omega) {
      const v = scale3(omega, L / Math.max(1e-9, len3(omega)) * Math.min(1.6, Math.max(0.6, len3(omega))));
      arrow3(ctx, P, p, v, pal.accent, 'fill', 2.2);
      label3(ctx, pal, P, p, v, 'ω', pal.accent);
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

    axisTriad(ctx, pal, cam, 40, view.h - 40);
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 4, worldHeight: 3, animate: false });
  useEffect(invalidate, [s, cam, ball]);

  const curves = props.curves ?? [];
  const layers = props.layers ?? [];
  const toggleLayer = (l: FrameLayer) => userSet({ show: on(l) ? s.show.filter((x) => x !== l) : [...s.show, l] });

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: מסילה במרחב והשלשה של פרנה בנקודה עליה, במבט שאפשר לסובב. ${describe()} גררו כדי לסובב את המבט; במקלדת: חיצים.`}
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
        setS(fresh(props));
        setCam({ yaw: props.yaw ?? 0.9, pitch: props.pitch ?? 0.35 });
        setLive('האיור אופס.');
      }}
      readout={
        <>
          <span data-readout="point">
            <bdi dir="ltr">t = {fmt(q.t)}</bdi>
          </span>
          <span data-readout="kappa">
            <bdi dir="ltr"><b class="q">κ = {fmt(q.k)}</b></bdi>
          </span>
          {!props.noTorsion && (
            <span data-readout="tau">
              {q.F ? <bdi dir="ltr"><b class="q">τ = {fmt(q.w)}</b></bdi> : <>הפיתול לא מוגדר (κ = 0)</>}
            </span>
          )}
          {omega && (
            <span data-readout="omega">
              <bdi dir="ltr">‖ω‖ = √(κ² + τ²) = {fmt(len3(omega))}</bdi>
            </span>
          )}
          {on('axis') && q.c.axis && q.F && (
            <span data-readout="axis">
              הזווית בין t לציר <bdi dir="ltr"><b class="q">{fmt(axisAngle)}°</b>, τ/κ = {fmt(q.w / q.k)}</bdi>
            </span>
          )}
          {osc && (
            <span data-readout="sphere">
              רדיוס הספרה המנשקת <bdi dir="ltr"><b class="q">√(ρ² + (ρ′σ)²) = {fmt(osc.radius)}</b></bdi>
            </span>
          )}
        </>
      }
      controls={
        <>
          {curves.length > 1 && (
            <div class="group" role="group" aria-label="המסילה">
              {curves.map((id) => (
                <Toggle key={id} label={curveOf(id).label} on={s.curve === id} onChange={() => userSet({ curve: id, i: iOf(curveOf(id), (curveOf(id).a + curveOf(id).b) / 2) })} />
              ))}
            </div>
          )}
          <Slider label="הפרמטר t" value={s.i} min={0} max={N} step={1} format={(i) => fmt(tOf(q.c, i))} onChange={(i) => userSet({ i: Math.round(i) })} />
          {(layers.length > 0 || props.transforms) && (
            <div class="group" role="group" aria-label="שכבות">
              {layers.map((l) => (
                <Toggle key={l} label={LAYER_LABEL[l]} on={on(l)} onChange={() => toggleLayer(l)} />
              ))}
              {props.transforms && <Toggle label="כיוון הפוך" on={s.reverse} onChange={(v) => userSet({ reverse: v, i: N - s.i })} />}
              {props.transforms && <Toggle label="שיקוף במישור z = 0" on={s.mirror} onChange={(v) => userSet({ mirror: v })} />}
            </div>
          )}
        </>
      }
    />
  );
}
