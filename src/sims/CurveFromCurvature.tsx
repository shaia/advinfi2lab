/**
 * Lesson 1.6 (and 2.4 later, in a 3D mode not built yet): the plane curve rebuilt from its signed curvature.
 * The reader picks a law k(s) (constant, linear = the Cornu spiral, 1/(s + c) = a logarithmic spiral, c·sin s), its
 * parameter c, the length L, the initial tangent angle θ₀ and the starting point; the figure integrates
 * θ(s) = θ₀ + ∫₀ˢ k and γ(s) = γ(0) + ∫₀ˢ (cos θ, sin θ) (src/math/planecurves.ts, rebuildFromK) and draws the
 * curve, its initial tangent, and the graph of k(s) underneath. Changing θ₀ and the start moves the same curve
 * rigidly; changing the sign of c reflects it. The integration is numerical (Simpson on 600 pieces), so the picture
 * is evidence for the theorem of the lesson, not its proof.
 */

import { useEffect, useState } from 'preact/hooks';
import { CURVATURE_LAWS, rebuildFromK, type P2 } from '~/math/planecurves';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { arrow, withAlpha } from './core/ink';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

const TASK_LABEL: Record<string, string> = {
  'close-circle': 'בעקמומיות קבועה, כוונו את האורך L עד שהמסילה נסגרת בדיוק (הקצה חוזר להתחלה).',
  cornu: 'בספירלת קורנו, הגדילו את L ל-10 או יותר וראו את המסילה מסתלסלת אל נקודה.',
  rotate: 'שנו את זווית ההתחלה θ₀ ובדקו שהמסילה רק מסתובבת: הצורה לא משתנה.',
  mirror: 'הפכו את הסימן של c (מחיובי לשלילי) וראו את המסילה משתקפת.',
};

const fmt = (v: number, sig = 3) => (Number.isFinite(v) ? sci(Math.round(v * 1e9) / 1e9, sig).replace(/^-/, '−') : '—');
const r2 = (v: number) => Math.round(v * 100) / 100;

interface State {
  law: string;
  c: number;
  len: number;
  theta0: number;
}

export interface CurveFromCurvatureProps {
  id: string;
  law?: string;
  laws?: string[];
  c?: number;
  len?: number;
  theta0?: number;
  /** offer the θ₀ slider */
  rotatable?: boolean;
  tasks?: string[];
}

const lawOf = (id: string) => CURVATURE_LAWS[id] ?? CURVATURE_LAWS.const;

function fresh(p: CurveFromCurvatureProps): State {
  const law = lawOf(p.law ?? 'const');
  return { law: law.id, c: p.c ?? law.c, len: p.len ?? 2 * Math.PI, theta0: p.theta0 ?? 0 };
}

function build(s: State) {
  const law = lawOf(s.law);
  const pts = rebuildFromK(law, s.c, s.len, { n: 600, theta0: s.theta0 });
  const end = pts[pts.length - 1];
  return { law, pts, end, gap: Math.hypot(end.x, end.y), thetaEnd: end.theta };
}

export default function CurveFromCurvature(props: CurveFromCurvatureProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const b = build(s);

  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const tick = (t: string) => markTask(`${props.id}:${t}`);
    const q = build(next);
    if (has('close-circle') && next.law === 'const' && Math.abs(next.c) >= 0.2 && next.len >= Math.PI / Math.abs(next.c) && q.gap < 0.02) tick('close-circle');
    if (has('cornu') && next.law === 'linear' && next.c !== 0 && next.len >= 10) tick('cornu');
    if (has('rotate') && patch.theta0 !== undefined && Math.abs(next.theta0) > 0.05) tick('rotate');
    if (has('mirror') && patch.c !== undefined && s.c > 0 && next.c < 0 && next.law !== 'inverse') tick('mirror');
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.law === 'string' && st.law in CURVATURE_LAWS) next.law = st.law;
          if (typeof st.c === 'number') next.c = st.c;
          if (typeof st.len === 'number') next.len = st.len;
          if (typeof st.theta0 === 'number') next.theta0 = st.theta0;
          return next;
        });
      }),
    [props.id],
  );

  const describe = () =>
    `העקמומיות ${b.law.formula} עם c = ${fmt(s.c)}, האורך L = ${fmt(s.len)}, זווית ההתחלה θ₀ = ${fmt(s.theta0)}. ` +
    `המסילה מתחילה בראשית ומסתיימת ב-(${fmt(b.end.x)}, ${fmt(b.end.y)}), במרחק ${fmt(b.gap)} מההתחלה; זווית המשיק בסוף ${fmt(b.thetaEnd)}.`;

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: pal }: FrameInfo) => {
    const plotH = Math.round(view.h * 0.24);
    const top = { w: view.w, h: view.h - plotH - 8 };
    // fit the curve (and the origin) into the upper panel, same scale on both axes
    let [x0, x1, y0, y1] = [0, 0, 0, 0];
    for (const q of b.pts) {
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    const span = Math.max(x1 - x0, y1 - y0, 1);
    const pad = 0.12 * span + 0.2;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const k = Math.min(top.w / (x1 - x0), top.h / (y1 - y0));
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const toS = (q: P2): [number, number] => [top.w / 2 + (q[0] - cx) * k, top.h / 2 - (q[1] - cy) * k];

    // axes through the origin
    const [ox, oy] = toS([0, 0]);
    ctx.save();
    ctx.strokeStyle = withAlpha(pal.ink3, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(top.w, oy);
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, top.h);
    ctx.stroke();
    ctx.restore();

    // the curve
    ctx.save();
    ctx.strokeStyle = pal.curve;
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    b.pts.forEach((q, j) => {
      const [x, y] = toS([q.x, q.y]);
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // start: a dot and the initial unit tangent; end: a hollow ring
    const S0 = toS([0, 0]);
    const T0 = toS([Math.cos(s.theta0) * Math.min(1, span / 3), Math.sin(s.theta0) * Math.min(1, span / 3)]);
    arrow(ctx, S0[0], S0[1], T0[0], T0[1], { color: pal.tangent, width: 2.4, head: 11 });
    tag(ctx, pal, 't₀', T0[0] + 10, T0[1] - 8, pal.tangent);
    ctx.save();
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.arc(S0[0], S0[1], 5, 0, 2 * Math.PI);
    ctx.fill();
    const E = toS([b.end.x, b.end.y]);
    ctx.strokeStyle = pal.ink;
    ctx.fillStyle = pal.paper;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(E[0], E[1], 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    tag(ctx, pal, 'γ(0)', S0[0] - 18, S0[1] + 16, pal.ink);
    tag(ctx, pal, 'γ(L)', E[0] + 20, E[1] + 14, pal.ink);

    // the graph of k(s) underneath
    const py0 = view.h - plotH;
    const L = { x: 36, w: view.w - 52 };
    let kmin = 0;
    let kmax = 0;
    const ks: number[] = [];
    for (let j = 0; j <= 200; j++) {
      const v = b.law.k((s.len * j) / 200, s.c);
      ks.push(v);
      kmin = Math.min(kmin, v);
      kmax = Math.max(kmax, v);
    }
    if (kmax - kmin < 1e-9) { kmax += 1; kmin -= 1; }
    const ky = (v: number) => py0 + 8 + (plotH - 22) * (1 - (v - kmin) / (kmax - kmin));
    ctx.save();
    ctx.fillStyle = withAlpha(pal.paper2, 0.9);
    ctx.fillRect(0, py0 - 4, view.w, plotH + 4);
    ctx.strokeStyle = pal.rule;
    ctx.beginPath();
    ctx.moveTo(0, py0 - 4);
    ctx.lineTo(view.w, py0 - 4);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(pal.ink3, 0.6);
    ctx.beginPath();
    ctx.moveTo(L.x, ky(0));
    ctx.lineTo(L.x + L.w, ky(0));
    ctx.moveTo(L.x, py0 + 4);
    ctx.lineTo(L.x, view.h - 10);
    ctx.stroke();
    ctx.strokeStyle = pal.curve2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ks.forEach((v, j) => {
      const x = L.x + (L.w * j) / 200;
      if (j === 0) ctx.moveTo(x, ky(v));
      else ctx.lineTo(x, ky(v));
    });
    ctx.stroke();
    ctx.font = `11px ${pal.fontUi}`;
    ctx.direction = 'ltr';
    ctx.fillStyle = pal.ink3;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(fmt(kmax), L.x - 4, ky(kmax));
    ctx.fillText(fmt(kmin), L.x - 4, ky(kmin));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`s = ${fmt(s.len)}`, L.x + L.w - 20, ky(0) + 3);
    ctx.restore();
    tag(ctx, pal, 'k(s)', L.x + 26, py0 + 12, pal.curve2);
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 4, worldHeight: 3, animate: false });
  useEffect(invalidate, [s]);

  const laws = props.laws ?? [];
  const law = b.law;
  return (
    <SimShell
      fig={props.id}
      label={`איור חי: מסילה מישורית שנבנית מהעקמומיות המסומנת שלה, ומתחתיה הגרף של העקמומיות לפי אורך הקשת. ${describe()}`}
      canvasRef={canvasRef}
      aspect={4 / 3}
      live={live}
      tasks={tasks}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={
        <>
          <span data-readout="law">
            <bdi dir="ltr"><b class="q">{law.formula}</b>, c = {fmt(s.c)}</bdi>
          </span>
          <span data-readout="theta">
            <bdi dir="ltr"><b class="q">θ(L) = θ₀ + ∫k = {fmt(b.thetaEnd)}</b></bdi>
          </span>
          <span data-readout="gap">
            הקצה <bdi dir="ltr">γ(L) = ({fmt(b.end.x)}, {fmt(b.end.y)})</bdi>, במרחק <b class="q">{fmt(b.gap)}</b> מההתחלה
          </span>
        </>
      }
      controls={
        <>
          {laws.length > 1 && (
            <div class="group" role="group" aria-label="העקמומיות">
              {laws.map((id) => (
                <Toggle key={id} label={lawOf(id).label} on={s.law === id} onChange={() => userSet({ law: id, c: lawOf(id).c })} />
              ))}
            </div>
          )}
          <Slider label="הפרמטר c" value={s.c} min={law.cMin} max={law.cMax} step={0.05} format={(v) => fmt(v)} onChange={(v) => userSet({ c: r2(v) })} />
          <Slider label="האורך L" value={s.len} min={0.5} max={20} step={0.01} format={(v) => fmt(v)} onChange={(v) => userSet({ len: r2(v) })} />
          {props.rotatable && (
            <Slider label="זווית ההתחלה θ₀" value={s.theta0} min={-3.14} max={3.14} step={0.01} format={(v) => fmt(v)} onChange={(v) => userSet({ theta0: r2(v) })} />
          )}
        </>
      }
    />
  );
}

function tag(ctx: CanvasRenderingContext2D, pal: Palette, text: string, x: number, y: number, color: string) {
  ctx.save();
  ctx.font = `italic 600 14px ${pal.fontUi}`;
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
