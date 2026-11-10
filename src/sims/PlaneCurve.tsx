/**
 * Lessons 1.1–1.5: a plane curve, a point γ(t) on it, and what the lessons attach to that point. One figure, several
 * layers, so every lesson of the chapter reads the same picture:
 * - 'trace'        (1.1) the part of the image already traced from t = a to t is bold, the rest faint: the curve is
 *                  the function, the image is the set;
 * - 'velocity'     (1.1) γ′(t) drawn at true scale, from γ(t);
 * - 'tangent-line' (1.1) the tangent line γ(t) + λγ′(t);
 * - 'unit'         (1.3) the unit tangent t, length 1;
 * - 'polygon'      (1.2) the polygon inscribed at n + 1 equally spaced parameters, with its length against ∫‖γ′‖;
 * - 'normal'       (1.3) the principal normal n, defined where κ > 0;
 * - 'osculating'   (1.4) the osculating circle: centre γ + n/κ, radius ρ = 1/κ;
 * - 'signed'       (1.5) the rotated normal n_s (t turned by +90°) and the signed curvature k;
 * - 'angle'        (1.5) the tangent angle θ, a continuous lift of arg γ′, measured from the x-direction.
 *
 * Every number comes from src/math/planecurves.ts, which holds each preset's exact derivatives. The parameter sits
 * on a grid of N = 600 steps across [a, b], so t = 0 (the cusp, the vertex, the inflection) is reachable exactly.
 * A figure shows one point at a time: it is evidence, and the captions say so.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import {
  PLANE_CURVES,
  arcLength2,
  kappa,
  osculatingCentre2,
  polygonLength,
  principalNormal,
  reversed,
  rotatedNormal,
  signedK,
  speed,
  tangentAngle,
  unitTangent,
  type P2,
  type PlaneCurve as Curve,
} from '~/math/planecurves';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { arrow, chevron, withAlpha } from './core/ink';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

export type Layer = 'trace' | 'velocity' | 'accel' | 'tangent-line' | 'unit' | 'polygon' | 'normal' | 'osculating' | 'signed' | 'angle' | 'arclength';

const LAYER_LABEL: Record<Layer, string> = {
  trace: 'המסלול עד t',
  velocity: 'וקטור המהירות',
  accel: 'הנגזרת השנייה ורכיביה',
  'tangent-line': 'הישר המשיק',
  unit: 'המשיק היחידה',
  polygon: 'קו שבור',
  normal: 'הנורמל הראשי',
  osculating: 'המעגל המנשק',
  signed: 'הנורמל המסובב',
  angle: 'זווית המשיק',
  arclength: 'אורך הקשת',
};

const TASK_LABEL: Record<string, string> = {
  'cusp-zero': 'במסילה עם החוד, הביאו את t לנקודה שבה וקטור המהירות מתאפס.',
  'slow-line-zero': 'במסילה (t³, t³), הביאו את t לנקודה שבה וקטור המהירות מתאפס, ובדקו שאין שם חוד.',
  'loop-twice': 'בלולאה (t³ − t, t²), מצאו ערך t שבו המסילה עוברת בפעם השנייה בנקודה (0, 1), וקראו את וקטור המהירות שם.',
  'second-lap': 'במסילה (cos 2t, sin 2t), הזיזו את t עד שהנקודה מתחילה סיבוב שני על אותו מעגל.',
  'reverse-image': 'הפכו את כיוון המסילה ובדקו שהתמונה לא השתנתה ושווקטור המהירות התהפך.',
  'polygon-close': 'הוסיפו קטעים לקו השבור עד שאורכו בתוך 1% מאורך המסילה.',
  'polygon-cycloid': 'בציקלואידה, מצאו את המספר הקטן ביותר של קטעים שאורכם בתוך 1% מ-8.',
  'arclength-half': 'בספירלה הלוגריתמית, הזיזו את הנקודה עד שאורך הקשת מההתחלה הוא חצי מאורך המסילה.',
  'circle-curvature': 'במעגל, הזיזו את הנקודה ובדקו שהעקמומיות אינה משתנה.',
  'ellipse-max-k': 'באליפסה, מצאו נקודה שבה העקמומיות הגדולה ביותר.',
  'inflection': 'בגרף של x³, מצאו את הנקודה שבה העקמומיות מתאפסת והנורמל הראשי נעלם.',
  'parabola-vertex': 'בפרבולה, מצאו את הנקודה שבה המעגל המנשק הקטן ביותר.',
  'ellipse-min': 'באליפסה, מצאו נקודה שבה רדיוס העקמומיות הקטן ביותר.',
  'ellipse-max': 'באליפסה, מצאו נקודה שבה רדיוס העקמומיות הגדול ביותר.',
  'exp-max': 'בגרף של eˣ, מצאו בקירוב את הנקודה שבה העקמומיות מקסימלית.',
  'turn-right': 'מצאו נקודה שבה העקמומיות המסומנת שלילית: המסילה פונה ימינה.',
  'reverse-sign': 'בנקודה שבה העקמומיות אינה אפס, הפכו את כיוון המסילה וראו את הסימן של k מתהפך.',
  'eight-total': 'בשמינייה, הביאו את t לסוף המסילה וקראו את השינוי הכולל בזווית המשיק.',
};

const N = 600;
/** where a newly chosen curve puts its point: 30% along the parameter, away from every task's special point */
const START_I = 180;
const fmt = (v: number, sig = 3) => (Number.isFinite(v) ? sci(Math.round(v * 1e9) / 1e9, sig).replace(/^-/, '−') : '—');
const fmtV = (p: P2) => `(${fmt(p[0])}, ${fmt(p[1])})`;

interface State {
  curve: string;
  /** parameter index 0…N */
  i: number;
  n: number;
  layers: Layer[];
  reverse: boolean;
}

export interface PlaneCurveProps {
  id: string;
  curve?: string;
  /** presets offered as toggles (none: the curve is fixed) */
  curves?: string[];
  /** starting parameter (snapped to the grid) */
  t?: number;
  /** layers drawn at the start */
  layers?: Layer[];
  /** layers the reader can switch on and off */
  toggles?: Layer[];
  /** segments of the inscribed polygon */
  n?: number;
  /** offer a "reverse direction" toggle */
  reversible?: boolean;
  reverse?: boolean;
  tasks?: string[];
}

const curveOf = (id: string): Curve => PLANE_CURVES[id] ?? PLANE_CURVES.circle;
const tOf = (c: Curve, i: number) => c.a + ((c.b - c.a) * i) / N;
const iOf = (c: Curve, t: number) => Math.max(0, Math.min(N, Math.round(((t - c.a) / (c.b - c.a)) * N)));

function fresh(p: PlaneCurveProps): State {
  const c = curveOf(p.curve ?? 'circle');
  return {
    curve: c.id,
    i: iOf(c, p.t ?? (c.a + c.b) / 2),
    n: p.n ?? 4,
    layers: p.layers ?? ['velocity'],
    reverse: p.reverse ?? false,
  };
}

/** The curve actually drawn: the preset, reversed when asked. Parameter index i means t = a + (b − a)i/N either way. */
const active = (s: State): Curve => (s.reverse ? reversed(curveOf(s.curve)) : curveOf(s.curve));

/** Everything the readouts and the tasks need at the current point. */
function measure(s: State) {
  const c = active(s);
  const t = tOf(c, s.i);
  const v = c.d1(t);
  const sp = speed(c, t);
  const k = signedK(c, t);
  const kap = kappa(c, t);
  const L = arcLength2(c, c.a, c.b, 1200);
  const P = polygonLength(c, s.n);
  return {
    c, t, p: c.p(t), v, sp, k, kap,
    rho: Number.isFinite(kap) && kap > 0 ? 1 / kap : Infinity,
    centre: osculatingCentre2(c, t),
    T: sp > 0 ? unitTangent(c, t) : null,
    n: principalNormal(c, t),
    ns: sp > 0 ? rotatedNormal(c, t) : null,
    theta: c.regular ? tangentAngle(c, t) : NaN,
    theta0: c.regular ? tangentAngle(c, c.a) : NaN,
    s: arcLength2(c, c.a, t, 400),
    L, P,
  };
}

/** A fixed view box per preset (the image's bounding box, padded), so the picture does not jump as t moves. */
function viewBox(c: Curve) {
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let j = 0; j <= 400; j++) {
    const [x, y] = c.p(c.a + ((c.b - c.a) * j) / 400);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const pad = 0.22 * Math.max(x1 - x0, y1 - y0) + 0.35;
  return { x0: x0 - pad, x1: x1 + pad, y0: y0 - pad, y1: y1 + pad };
}

export default function PlaneCurve(props: PlaneCurveProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const geo = useRef<{ toS: (q: P2) => [number, number] } | null>(null);
  const dragging = useRef(false);
  const m = measure(s);
  const on = (l: Layer) => s.layers.includes(l);

  /** The reader's own change. A text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const tick = (t: string) => markTask(`${props.id}:${t}`);
    const q = measure(next);
    const has0 = (l: Layer) => next.layers.includes(l);
    if (has('cusp-zero') && next.curve === 'cusp' && Math.abs(q.t) < 1e-9) tick('cusp-zero');
    if (has('slow-line-zero') && next.curve === 'slow-line' && Math.abs(q.t) < 1e-9) tick('slow-line-zero');
    if (has('loop-twice') && next.curve === 'loop' && Math.abs(Math.abs(q.t) - 1) < 1e-9) tick('loop-twice');
    if (has('second-lap') && next.curve === 'circle-fast' && q.t > Math.PI + 0.05) tick('second-lap');
    if (has('reverse-image') && patch.reverse !== undefined && patch.reverse !== s.reverse) tick('reverse-image');
    if (has('polygon-close') && has0('polygon') && (q.L - q.P) / q.L < 0.01) tick('polygon-close');
    if (has('polygon-cycloid') && has0('polygon') && next.curve === 'cycloid' && (q.L - q.P) / q.L < 0.01 && (q.L - polygonLength(q.c, next.n - 1)) / q.L >= 0.01) tick('polygon-cycloid');
    // the reader moved the point along the same curve (choosing a curve also sets i, and must not count)
    const moved = patch.i !== undefined && patch.curve === undefined && patch.i !== s.i;
    if (has('circle-curvature') && next.curve === 'circle' && moved) tick('circle-curvature');
    if (has('inflection') && next.curve === 'cubic' && Math.abs(q.k) < 1e-9) tick('inflection');
    if (has('parabola-vertex') && next.curve === 'parabola' && Math.abs(q.t) < 1e-9) tick('parabola-vertex');
    if (has('ellipse-min') && next.curve === 'ellipse' && q.rho <= 0.5 + 1e-6) tick('ellipse-min');
    if (has('ellipse-max-k') && next.curve === 'ellipse' && q.kap >= 2 - 1e-6) tick('ellipse-max-k');
    if (has('ellipse-max') && next.curve === 'ellipse' && q.rho >= 4 - 1e-6) tick('ellipse-max');
    if (has('exp-max') && next.curve === 'exp' && Math.abs(q.t + Math.log(2) / 2) < 0.03) tick('exp-max');
    if (has('turn-right') && has0('signed') && moved && q.k < -1e-9) tick('turn-right');
    if (has('reverse-sign') && patch.reverse !== undefined && patch.reverse !== s.reverse && Math.abs(q.k) > 1e-6) tick('reverse-sign');
    if (has('eight-total') && has0('angle') && next.curve === 'eight' && next.i === N) tick('eight-total');
    if (has('arclength-half') && has0('arclength') && next.curve === 'logspiral' && moved && Math.abs(q.s - q.L / 2) <= 0.01) tick('arclength-half');
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.curve === 'string' && st.curve in PLANE_CURVES) next.curve = st.curve;
          if (typeof st.t === 'number') next.i = iOf(curveOf(next.curve), st.t);
          if (typeof st.n === 'number') next.n = Math.max(1, Math.min(64, Math.round(st.n)));
          if (Array.isArray(st.layers)) next.layers = st.layers.filter((l): l is Layer => typeof l === 'string' && l in LAYER_LABEL);
          if (typeof st.reverse === 'boolean') next.reverse = st.reverse;
          return next;
        });
      }),
    [props.id],
  );

  const describe = () => {
    const c = m.c;
    const parts = [`המסילה ${c.formula}${s.reverse ? ' בכיוון ההפוך' : ''}, t = ${fmt(m.t)}, הנקודה ${fmtV(m.p)}.`];
    if (on('velocity')) parts.push(m.sp === 0 ? 'וקטור המהירות הוא אפס.' : `וקטור המהירות ${fmtV(m.v)}, באורך ${fmt(m.sp)}.`);
    if (on('polygon')) parts.push(`קו שבור עם ${s.n} קטעים, באורך ${fmt(m.P, 4)}; אורך המסילה ${fmt(m.L, 4)}.`);
    if (on('normal') || on('osculating')) parts.push(Number.isFinite(m.kap) ? `העקמומיות ${fmt(m.kap)}${m.kap > 0 ? `, הרדיוס ${fmt(m.rho)}` : ', אין מעגל מנשק'}.` : 'העקמומיות לא מוגדרת: וקטור המהירות אפס.');
    if (on('signed') && Number.isFinite(m.k)) parts.push(`העקמומיות המסומנת ${fmt(m.k)}: ${m.k > 0 ? 'פונה שמאלה' : m.k < 0 ? 'פונה ימינה' : 'κ = 0 כאן'}.`);
    if (on('angle') && Number.isFinite(m.theta)) parts.push(`זווית המשיק ${fmt(m.theta)} רדיאנים; השינוי מההתחלה ${fmt(m.theta - m.theta0)}.`);
    return parts.join(' ');
  };

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: pal }: FrameInfo) => {
    const c = m.c;
    const box = viewBox(curveOf(s.curve));
    const k = Math.min(view.w / (box.x1 - box.x0), view.h / (box.y1 - box.y0));
    const cxw = (box.x0 + box.x1) / 2;
    const cyw = (box.y0 + box.y1) / 2;
    const toS = (q: P2): [number, number] => [view.w / 2 + (q[0] - cxw) * k, view.h / 2 - (q[1] - cyw) * k];
    geo.current = { toS };
    const P = toS(m.p);

    drawAxes(ctx, pal, toS, view.w, view.h, k, box);

    // the image: the whole curve in ink; with 'trace', faint, and bold from a to t
    const path = (t0: number, t1: number) => {
      const steps = Math.max(2, Math.ceil((Math.abs(t1 - t0) / (c.b - c.a)) * 800));
      ctx.beginPath();
      for (let j = 0; j <= steps; j++) {
        const [x, y] = toS(c.p(t0 + ((t1 - t0) * j) / steps));
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (on('trace')) {
      ctx.strokeStyle = withAlpha(pal.curve, 0.25);
      ctx.lineWidth = 2;
      path(c.a, c.b);
      ctx.strokeStyle = pal.curve;
      ctx.lineWidth = 3.4;
      if (m.t > c.a) path(c.a, m.t);
    } else {
      ctx.strokeStyle = pal.curve;
      ctx.lineWidth = 2.4;
      path(c.a, c.b);
    }
    ctx.restore();

    // orientation: chevrons along the direction of motion (shape, not colour)
    for (const f of [0.14, 0.38, 0.62, 0.86]) {
      const tt = c.a + f * (c.b - c.a);
      if (speed(c, tt) < 1e-9) continue;
      const [ux, uy] = unitTangent(c, tt);
      const [x, y] = toS(c.p(tt));
      chevron(ctx, x, y, ux, -uy, 7, pal.ink2);
    }

    // inscribed polygon
    if (on('polygon')) {
      ctx.save();
      ctx.strokeStyle = pal.curve2;
      ctx.fillStyle = pal.curve2;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (let j = 0; j <= s.n; j++) {
        const [x, y] = toS(c.p(c.a + ((c.b - c.a) * j) / s.n));
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let j = 0; j <= s.n; j++) {
        const [x, y] = toS(c.p(c.a + ((c.b - c.a) * j) / s.n));
        ctx.beginPath();
        ctx.rect(x - 3, y - 3, 6, 6);
        ctx.fill();
      }
      ctx.restore();
    }

    // osculating circle and centre
    if (on('osculating') && m.centre) {
      const O = toS(m.centre);
      ctx.save();
      ctx.strokeStyle = pal.limit;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.arc(O[0], O[1], m.rho * k, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(P[0], P[1]);
      ctx.lineTo(O[0], O[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = pal.limit;
      ctx.beginPath();
      ctx.moveTo(O[0], O[1] - 6);
      ctx.lineTo(O[0] + 6, O[1]);
      ctx.lineTo(O[0], O[1] + 6);
      ctx.lineTo(O[0] - 6, O[1]);
      ctx.closePath();
      ctx.fill();
      // ρ sits beside the radius, three quarters of the way to the centre: the n arrow (length 1) and its
      // label occupy the start of the same segment
      {
        const d = Math.hypot(O[0] - P[0], O[1] - P[1]) || 1;
        const [ux, uy] = [(O[0] - P[0]) / d, (O[1] - P[1]) / d];
        label(ctx, pal, 'ρ', P[0] + 0.75 * (O[0] - P[0]) - uy * 12, P[1] + 0.75 * (O[1] - P[1]) + ux * 12, pal.limit);
      }
      ctx.restore();
    }

    // tangent line
    if (on('tangent-line') && m.T) {
      const [ux, uy] = m.T;
      const big = 40;
      const A = toS([m.p[0] - big * ux, m.p[1] - big * uy]);
      const B = toS([m.p[0] + big * ux, m.p[1] + big * uy]);
      ctx.save();
      ctx.strokeStyle = withAlpha(pal.tangent, 0.7);
      ctx.lineWidth = 1.4;
      ctx.setLineDash([9, 6]);
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(B[0], B[1]);
      ctx.stroke();
      ctx.restore();
    }

    // tangent angle: a horizontal reference and the arc from it to t
    if (on('angle') && m.T && Number.isFinite(m.theta)) {
      ctx.save();
      ctx.strokeStyle = pal.ink3;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(P[0], P[1]);
      ctx.lineTo(P[0] + 70, P[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      const a = Math.atan2(m.T[1], m.T[0]);
      ctx.strokeStyle = pal.tangent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(P[0], P[1], 30, 0, -a, a > 0);
      ctx.stroke();
      label(ctx, pal, 'θ', P[0] + 36 * Math.cos(a / 2), P[1] - 36 * Math.sin(a / 2), pal.tangent);
      ctx.restore();
    }

    // vectors: velocity at true scale; unit vectors of length 1
    // `side` moves the label off the arrow's line (+1 one side, −1 the other), so labels of arrows that can
    // coincide (γ′ and t at unit speed, n and nₛ where k > 0) never print over each other
    const vec = (d: P2, color: string, text: string, dash = false, width = 2.4, side = 0) => {
      const E = toS([m.p[0] + d[0], m.p[1] + d[1]]);
      ctx.save();
      if (dash) ctx.setLineDash([5, 4]);
      arrow(ctx, P[0], P[1], E[0], E[1], { color, width, head: 11 });
      ctx.restore();
      const L = Math.hypot(E[0] - P[0], E[1] - P[1]) || 1;
      const [ux, uy] = [(E[0] - P[0]) / L, (E[1] - P[1]) / L];
      label(ctx, pal, text, E[0] + ux * 12 - uy * side * 14, E[1] + uy * 12 + ux * side * 14, color);
    };
    if (on('velocity') && m.sp > 0) vec(m.v, pal.ink2, 'γ′', false, 2, 1);
    if (on('accel') && m.T) {
      // γ″ = v′ t + κ v² n: the part along t (dashed, warm) and the part along the normal (dashed, green)
      const a = c.d2(m.t);
      const along = a[0] * m.T[0] + a[1] * m.T[1];
      const At: P2 = [along * m.T[0], along * m.T[1]];
      const An: P2 = [a[0] - At[0], a[1] - At[1]];
      if (Math.hypot(...At) > 1e-9) vec(At, withAlpha(pal.tangent, 0.75), 'v′t', true, 1.6);
      if (Math.hypot(...An) > 1e-9) vec(An, withAlpha(pal.normal, 0.75), 'κv²n', true, 1.6);
      vec(a, pal.ink3, 'γ″', false, 2);
    }
    if (on('unit') && m.T) vec(m.T, pal.tangent, 't', false, 2.4, on('velocity') ? -1 : 0);
    if (on('normal') && m.n) vec(m.n, pal.normal, 'n', false, 2.4, on('signed') ? 1 : 0);
    if (on('signed') && m.ns) vec(m.ns, pal.normal, 'nₛ', true, 2.4, on('normal') ? -1 : 0);

    // the point
    ctx.save();
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.arc(P[0], P[1], 5.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
    label(ctx, pal, 'γ(t)', P[0] - 12, P[1] + 16, pal.ink);
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 4, worldHeight: 3, animate: false });
  useEffect(invalidate, [s]);

  const nearest = (e: PointerEvent): number | null => {
    const g = geo.current;
    if (!g) return null;
    const c = m.c;
    let best = s.i;
    let bd = Infinity;
    for (let j = 0; j <= N; j++) {
      const [x, y] = g.toS(c.p(tOf(c, j)));
      const d = (x - e.offsetX) ** 2 + (y - e.offsetY) ** 2;
      // prefer the parameter closest to the current one among near-ties (self-crossings, the second lap)
      if (d < bd - 1e-6 || (Math.abs(d - bd) <= 1e-6 && Math.abs(j - s.i) < Math.abs(best - s.i))) {
        bd = d;
        best = j;
      }
    }
    return bd < 900 ? best : null;
  };
  const onPointerDown = (e: PointerEvent) => {
    const j = nearest(e);
    if (j === null) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (j !== s.i) userSet({ i: j });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const j = nearest(e);
    if (j !== null && j !== s.i) userSet({ i: j });
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    userSet({ i: Math.max(0, Math.min(N, s.i + d * (e.shiftKey ? 10 : 1))) });
  };

  const curves = props.curves ?? [];
  const toggles = props.toggles ?? [];
  const toggleLayer = (l: Layer) => userSet({ layers: on(l) ? s.layers.filter((x) => x !== l) : [...s.layers, l] });
  const c = m.c;

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: מסילה במישור ונקודה γ(t) עליה. גררו את הנקודה לאורך המסילה או הזיזו את המחוון; במקלדת: החצים משנים את t. ${describe()}`}
      canvasRef={canvasRef}
      aspect={4 / 3}
      live={live}
      tasks={tasks}
      cursor="pointer"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={
        <>
          <span data-readout="point">
            <bdi dir="ltr">
              <b class="q">γ(t) = {c.formula}</b>, t = {fmt(m.t)}, γ(t) = {fmtV(m.p)}
            </bdi>
            {s.reverse && <> (בכיוון ההפוך)</>}
          </span>
          {on('velocity') && (
            <span data-readout="velocity">
              {m.sp === 0 ? (
                <>
                  <bdi dir="ltr"><b class="q">γ′(t) = (0, 0)</b></bdi>: אין משיק מוגדר בנקודה הזו.
                </>
              ) : (
                <bdi dir="ltr">
                  <b class="q">γ′(t) = {fmtV(m.v)}</b>, ‖γ′(t)‖ = {fmt(m.sp)}
                </bdi>
              )}
            </span>
          )}
          {on('accel') && m.T && (
            <span data-readout="accel">
              <bdi dir="ltr">
                <b class="q">γ″(t) = {fmtV(c.d2(m.t))}</b> = {fmt(c.d2(m.t)[0] * m.T[0] + c.d2(m.t)[1] * m.T[1])}·t + {fmt(m.kap * m.sp * m.sp)}·n
              </bdi>
            </span>
          )}
          {on('polygon') && (
            <span data-readout="polygon">
              קו שבור עם <b class="q">{s.n}</b> קטעים: אורך <b class="q">{fmt(m.P, 4)}</b>; אורך המסילה <b class="q">{fmt(m.L, 4)}</b> (פער {fmt((100 * (m.L - m.P)) / m.L, 2)}%)
            </span>
          )}
          {(on('unit') || on('normal') || on('osculating')) && (
            <span data-readout="curvature">
              {!Number.isFinite(m.kap) ? (
                <>העקמומיות לא מוגדרת: γ′ = 0.</>
              ) : (
                <>
                  <bdi dir="ltr"><b class="q">κ = {fmt(m.kap)}</b></bdi>
                  {m.kap > 1e-12 ? (
                    <>
                      , <bdi dir="ltr"><b class="q">ρ = 1/κ = {fmt(m.rho)}</b></bdi>
                      {on('osculating') && m.centre && <>, מרכז העקמומיות <bdi dir="ltr">{fmtV(m.centre)}</bdi></>}
                    </>
                  ) : (
                    <>: אין נורמל ראשי ואין מעגל מנשק.</>
                  )}
                </>
              )}
            </span>
          )}
          {on('signed') && (
            <span data-readout="signed">
              {!Number.isFinite(m.k) ? (
                <>העקמומיות המסומנת לא מוגדרת: γ′ = 0.</>
              ) : (
                <>
                  <bdi dir="ltr"><b class="q">k = {fmt(m.k)}</b></bdi>: {m.k > 1e-9 ? 'המסילה פונה שמאלה' : m.k < -1e-9 ? 'המסילה פונה ימינה' : 'κ = 0 כאן (למשל נקודה שבה הקעירות מתחלפת)'}
                </>
              )}
            </span>
          )}
          {on('arclength') && (
            <span data-readout="arclength">
              אורך הקשת מתחילת המסילה <bdi dir="ltr"><b class="q">s(t) = {fmt(m.s, 4)}</b></bdi>, מתוך האורך הכולל <bdi dir="ltr"><b class="q">L = {fmt(m.L, 4)}</b></bdi>
            </span>
          )}
          {on('angle') && Number.isFinite(m.theta) && (
            <span data-readout="angle">
              <bdi dir="ltr"><b class="q">θ = {fmt(m.theta)}</b></bdi>, השינוי מתחילת המסילה <bdi dir="ltr"><b class="q">{fmt(m.theta - m.theta0)}</b></bdi>, אורך הקשת <bdi dir="ltr">s = {fmt(m.s)}</bdi>
            </span>
          )}
        </>
      }
      controls={
        <>
          {curves.length > 1 && (
            <div class="group" role="group" aria-label="המסילה">
              {curves.map((id) => (
                <Toggle key={id} label={curveOf(id).label} on={s.curve === id} onChange={() => userSet({ curve: id, i: START_I })} />
              ))}
            </div>
          )}
          <Slider label="הפרמטר t" value={s.i} min={0} max={N} step={1} format={(i) => fmt(tOf(c, i))} onChange={(i) => userSet({ i: Math.round(i) })} />
          {on('polygon') && <Slider label="מספר הקטעים" value={s.n} min={1} max={64} step={1} format={(v) => String(v)} onChange={(v) => userSet({ n: Math.round(v) })} />}
          {(toggles.length > 0 || props.reversible) && (
            <div class="group" role="group" aria-label="מה מצויר">
              {toggles.map((l) => (
                <Toggle key={l} label={LAYER_LABEL[l]} on={on(l)} onChange={() => toggleLayer(l)} />
              ))}
              {props.reversible && <Toggle label="כיוון הפוך" on={s.reverse} onChange={(v) => userSet({ reverse: v })} />}
            </div>
          )}
        </>
      }
    />
  );
}

function label(ctx: CanvasRenderingContext2D, pal: Palette, text: string, x: number, y: number, color: string) {
  ctx.save();
  ctx.font = `italic 600 15px ${pal.fontUi}`;
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

function drawAxes(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  toS: (q: P2) => [number, number],
  w: number,
  h: number,
  k: number,
  box: { x0: number; x1: number; y0: number; y1: number },
) {
  const [ox, oy] = toS([0, 0]);
  ctx.save();
  ctx.strokeStyle = withAlpha(pal.ink3, 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (oy > 0 && oy < h) {
    ctx.moveTo(0, oy);
    ctx.lineTo(w, oy);
  }
  if (ox > 0 && ox < w) {
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, h);
  }
  ctx.stroke();
  ctx.font = `11px ${pal.fontUi}`;
  ctx.direction = 'ltr';
  ctx.fillStyle = pal.ink3;
  // integer ticks, skipping 0, while they are at least 28 px apart
  const stepW = k >= 28 ? 1 : k >= 14 ? 2 : 5;
  for (let x = Math.ceil(box.x0 / stepW) * stepW; x <= box.x1; x += stepW) {
    if (x === 0 || oy <= 0 || oy >= h) continue;
    const [sx] = toS([x, 0]);
    ctx.fillRect(sx - 0.5, oy - 3, 1, 6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(x).replace('-', '−'), sx, oy + 5);
  }
  for (let y = Math.ceil(box.y0 / stepW) * stepW; y <= box.y1; y += stepW) {
    if (y === 0 || ox <= 0 || ox >= w) continue;
    const [, sy] = toS([0, y]);
    ctx.fillRect(ox - 3, sy - 0.5, 6, 1);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(y).replace('-', '−'), ox - 6, sy);
  }
  ctx.restore();
}
