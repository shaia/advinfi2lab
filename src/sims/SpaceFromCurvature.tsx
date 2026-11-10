/**
 * Lesson 2.4: the space curve rebuilt from its curvature κ(s) > 0 and torsion τ(s). The reader picks a law
 * (constant = a helix, a torsion growing linearly, an oscillating torsion, a constant ratio τ/κ), its parameters c₁
 * and c₂, the length L, a rotation φ of the starting frame about the axis (1, 1, 1)/√3, and may replace τ by −τ.
 * The figure integrates the Frenet–Serret system t′ = κn, n′ = −κt + τb, b′ = −τn, γ′ = t from γ(0) = 0 and the
 * standard frame (rotated by φ) with RK4 (src/math/spacecurves.ts, rebuildFromKT), and draws the curve, the frame
 * at both ends, a faint copy of the unrotated curve, and the graphs of κ(s) and τ(s) underneath. The readout shows
 * how far the integrated frame is from orthonormal: the existence proof shows that it stays orthonormal.
 *
 * The integration is numerical, so the picture is evidence for the theorem, not its proof.
 * Tasks (ticked only by the reader's own controls): helix, flat, rotate, mirror, same-kappa.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SPACE_LAWS, helixFromKT, rebuildLaw, rotate, type Frame } from '~/math/spacecurves';
import { len3, scale3, type Vec3 } from '~/math/vec';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import { arrow3, axisTriad, curve3, label3, makeProjector, orbitHandlers, tag, type Cam } from './core/space';

const TASK_LABEL: Record<string, string> = {
  helix: 'בחוק "קבועים", קבעו פיתול שונה מאפס. איזו מסילה התקבלה, ומה הרדיוס שלה?',
  flat: 'קבעו c₂ = 0 (פיתול אפס). איפה מונחת המסילה?',
  rotate: 'שנו את הסיבוב φ של השלשה ההתחלתית. מה השתנה במסילה, ומה לא?',
  mirror: 'הפעילו "τ ← −τ". איך המסילה החדשה קשורה לישנה?',
  'same-kappa': 'השאירו את κ כמו שהוא ושנו רק את c₂ (את הפיתול) לפחות ב-0.5. האם העקמומיות לבדה קובעת את המסילה?',
};

const U: Vec3 = scale3([1, 1, 1], 1 / Math.sqrt(3));
const STD: Frame = { t: [1, 0, 0], n: [0, 1, 0], b: [0, 0, 1] };
const fmt = (v: number, sig = 3) => (Number.isFinite(v) ? sci(Math.round(v * 1e9) / 1e9, sig).replace(/^-/, '−') : '—');
const r2 = (v: number) => Math.round(v * 100) / 100;

interface State {
  law: string;
  c1: number;
  c2: number;
  len: number;
  phi: number;
  flip: boolean;
}

export interface SpaceFromCurvatureProps {
  id: string;
  law?: string;
  laws?: string[];
  c1?: number;
  c2?: number;
  len?: number;
  /** offer the φ slider (rotation of the starting frame) */
  rotatable?: boolean;
  /** offer the τ → −τ toggle */
  mirrorable?: boolean;
  yaw?: number;
  pitch?: number;
  tasks?: string[];
}

const lawOf = (id: string) => SPACE_LAWS[id] ?? SPACE_LAWS.const;

function fresh(p: SpaceFromCurvatureProps): State {
  const law = lawOf(p.law ?? 'const');
  return { law: law.id, c1: p.c1 ?? law.c1, c2: p.c2 ?? law.c2, len: p.len ?? 4 * Math.PI, phi: 0, flip: false };
}

function frameAt(phi: number): Frame {
  return { t: rotate(STD.t, U, phi), n: rotate(STD.n, U, phi), b: rotate(STD.b, U, phi) };
}

function build(s: State) {
  const law = lawOf(s.law);
  const c2 = s.flip ? -s.c2 : s.c2;
  const R = rebuildLaw(law, s.c1, c2, s.len, { n: 1200, frame0: frameAt(s.phi) });
  const ghost = s.phi !== 0 || s.flip ? rebuildLaw(law, s.c1, s.c2, s.len, { n: 1200 }).pts : null;
  return { law, c2eff: c2, ...R, ghost };
}

export default function SpaceFromCurvature(props: SpaceFromCurvatureProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [cam, setCam] = useState<Cam>({ yaw: props.yaw ?? -0.9, pitch: props.pitch ?? 0.4 });
  const camRef = useRef(cam);
  camRef.current = cam;
  const [live, setLive] = useState('');
  const c2seen = useRef<{ key: string; vals: number[] }>({ key: '', vals: [] });
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const b = useMemo(() => build(s), [s]);

  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const tick = (t: string) => markTask(`${props.id}:${t}`);
    if (has('helix') && patch.c2 !== undefined && next.law === 'const' && Math.abs(next.c2) >= 0.05) tick('helix');
    if (has('flat') && patch.c2 !== undefined && next.c2 === 0) tick('flat');
    if (has('rotate') && patch.phi !== undefined && Math.abs(next.phi) > 0.05) tick('rotate');
    if (has('mirror') && patch.flip === true && next.c2 !== 0) tick('mirror');
    if (patch.c2 !== undefined) {
      const key = `${next.law}:${next.c1}`;
      if (c2seen.current.key !== key) c2seen.current = { key, vals: [s.c2] };
      c2seen.current.vals.push(next.c2);
      const v = c2seen.current.vals;
      if (has('same-kappa') && Math.max(...v) - Math.min(...v) >= 0.5) tick('same-kappa');
    }
  };
  const orbitH = orbitHandlers(() => camRef.current, setCam);

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.law === 'string' && st.law in SPACE_LAWS) next.law = st.law;
          if (typeof st.c1 === 'number') next.c1 = st.c1;
          if (typeof st.c2 === 'number') next.c2 = st.c2;
          if (typeof st.len === 'number') next.len = st.len;
          if (typeof st.phi === 'number') next.phi = st.phi;
          if (typeof st.flip === 'boolean') next.flip = st.flip;
          return next;
        });
        if (typeof st.yaw === 'number' || typeof st.pitch === 'number')
          setCam((c) => ({ yaw: typeof st.yaw === 'number' ? st.yaw : c.yaw, pitch: typeof st.pitch === 'number' ? st.pitch : c.pitch }));
      }),
    [props.id],
  );

  const end = b.pts[b.pts.length - 1];
  const helix = s.law === 'const' ? helixFromKT(s.c1, b.c2eff) : null;
  const describe = () =>
    `העקמומיות והפיתול ${b.law.formula} עם c₁ = ${fmt(s.c1)}, c₂ = ${fmt(s.c2)}${s.flip ? ', והפיתול הוחלף בנגדי' : ''}; האורך L = ${fmt(s.len)}; סיבוב השלשה ההתחלתית φ = ${fmt(s.phi)}. ` +
    `המסילה מתחילה בראשית ומסתיימת ב-(${end.map((x) => fmt(x)).join(', ')}).`;

  useEffect(() => {
    const id = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(id);
  }, [s]);

  // a ball centred at the start, so a rotation about the start does not move the view
  const radius = useMemo(() => {
    const base = rebuildLaw(lawOf(s.law), s.c1, s.c2, s.len, { n: 300 }).pts;
    return Math.max(0.5, ...base.map((p) => len3(p)));
  }, [s.law, s.c1, s.c2, s.len]);

  const draw = ({ ctx, view, palette: pal }: FrameInfo) => {
    const plotH = Math.round(view.h * 0.19);
    const P = makeProjector(cam, [0, 0, 0], radius, view.w, view.h - plotH - 6, 0.94);
    const L = 0.2 * radius;
    if (b.ghost) curve3(ctx, P, b.ghost, withAlpha(pal.ink3, 0.6), 1.6, 0.25);
    curve3(ctx, P, b.pts, pal.curve, 2.6);
    const f0 = b.frames[0];
    const f1 = b.frames[b.frames.length - 1];
    for (const [p, F, sub] of [[b.pts[0], f0, '₀'], [end, f1, '']] as const) {
      arrow3(ctx, P, p, scale3(F.b, L), pal.binormal, 'bar', 2.2);
      arrow3(ctx, P, p, scale3(F.n, L), pal.normal, 'open', 2.2);
      arrow3(ctx, P, p, scale3(F.t, L), pal.tangent, 'fill', 2.2);
      if (sub) {
        label3(ctx, pal, P, p, scale3(F.t, L), `t${sub}`, pal.tangent);
        label3(ctx, pal, P, p, scale3(F.n, L), `n${sub}`, pal.normal);
        label3(ctx, pal, P, p, scale3(F.b, L), `b${sub}`, pal.binormal);
      }
    }
    const [x0, y0] = P(b.pts[0]);
    ctx.save();
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.arc(x0, y0, 4.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
    tag(ctx, pal, 'γ(0)', x0 - 26, y0 + 22, pal.ink, 13);
    const [xe, ye] = P(end);
    tag(ctx, pal, 'γ(L)', xe + 28, ye - 18, pal.ink, 13);
    axisTriad(ctx, pal, cam, 40, view.h - plotH - 46);

    // graphs of κ(s) and τ(s)
    const py0 = view.h - plotH;
    const box = { x: 40, w: view.w - 60 };
    const ks: number[] = [];
    const ws: number[] = [];
    let lo = 0;
    let hi = 0;
    for (let j = 0; j <= 200; j++) {
      const sj = (s.len * j) / 200;
      const k = b.law.kappa(sj, s.c1, b.c2eff);
      const w = b.law.tau(sj, s.c1, b.c2eff);
      ks.push(k);
      ws.push(w);
      lo = Math.min(lo, k, w);
      hi = Math.max(hi, k, w);
    }
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const yv = (v: number) => py0 + 8 + (plotH - 20) * (1 - (v - lo) / (hi - lo));
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
    ctx.moveTo(box.x, yv(0));
    ctx.lineTo(box.x + box.w, yv(0));
    ctx.stroke();
    for (const [arr, col, dash] of [[ks, pal.curve2, []], [ws, pal.binormal, [6, 4]]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash([...dash]);
      ctx.beginPath();
      arr.forEach((v, j) => {
        const x = box.x + (box.w * j) / 200;
        if (j === 0) ctx.moveTo(x, yv(v));
        else ctx.lineTo(x, yv(v));
      });
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.font = `11px ${pal.fontUi}`;
    ctx.direction = 'ltr';
    ctx.fillStyle = pal.ink3;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(fmt(hi), box.x - 4, yv(hi));
    ctx.fillText(fmt(lo), box.x - 4, yv(lo));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`s = ${fmt(s.len)}`, box.x + box.w - 22, yv(0) + 3);
    ctx.restore();
    tag(ctx, pal, 'κ(s)', box.x + 30, py0 + 12, pal.curve2, 13);
    tag(ctx, pal, 'τ(s) - - -', box.x + 100, py0 + 12, pal.binormal, 13);
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 4, worldHeight: 3, animate: false });
  useEffect(invalidate, [b, cam, radius]);

  const laws = props.laws ?? [];
  const law = b.law;
  return (
    <SimShell
      fig={props.id}
      label={`איור חי: מסילה במרחב שנבנית מהעקמומיות והפיתול שלה, עם השלשה של פרנה בהתחלה ובסוף, ומתחתיה הגרפים של κ ושל τ לפי אורך הקשת. ${describe()} גררו כדי לסובב את המבט; במקלדת: חיצים.`}
      canvasRef={canvasRef}
      aspect={1}
      live={live}
      tasks={tasks}
      cursor="grab"
      onKeyDown={orbitH.onKeyDown}
      onPointerDown={orbitH.onPointerDown}
      onPointerMove={orbitH.onPointerMove}
      onPointerUp={orbitH.onPointerUp}
      onReset={() => {
        setS(fresh(props));
        setCam({ yaw: props.yaw ?? -0.9, pitch: props.pitch ?? 0.4 });
        setLive('האיור אופס.');
      }}
      readout={
        <>
          <span data-readout="law">
            <bdi dir="ltr"><b class="q">{law.formula}</b>, c₁ = {fmt(s.c1)}, c₂ = {fmt(s.c2)}{s.flip ? ', τ ← −τ' : ''}</bdi>
          </span>
          {helix && Math.abs(b.c2eff) > 1e-9 && (
            <span data-readout="helix">
              סליל ברדיוס <bdi dir="ltr"><b class="q">a = κ/(κ² + τ²) = {fmt(helix.a)}</b></bdi>
            </span>
          )}
          <span data-readout="end">
            הקצה <bdi dir="ltr">γ(L) = ({end.map((x) => fmt(x)).join(', ')})</bdi>
          </span>
          <span data-readout="ortho">
            סטייה של השלשה מאורתונורמליות <bdi dir="ltr"><b class="q">{b.orthoDefect < 1e-14 ? '< 10⁻¹⁴' : sci(b.orthoDefect, 2)}</b></bdi>
          </span>
        </>
      }
      controls={
        <>
          {laws.length > 1 && (
            <div class="group" role="group" aria-label="העקמומיות והפיתול">
              {laws.map((id) => (
                <Toggle key={id} label={lawOf(id).label} on={s.law === id} onChange={() => userSet({ law: id, c1: lawOf(id).c1, c2: lawOf(id).c2 })} />
              ))}
            </div>
          )}
          <Slider label="הפרמטר c₁ (עקמומיות)" value={s.c1} min={law.c1Min} max={law.c1Max} step={0.05} format={(v) => fmt(v)} onChange={(v) => userSet({ c1: r2(v) })} />
          <Slider label="הפרמטר c₂ (פיתול)" value={s.c2} min={law.c2Min} max={law.c2Max} step={0.05} format={(v) => fmt(v)} onChange={(v) => userSet({ c2: r2(v) })} />
          <Slider label="האורך L" value={s.len} min={1} max={20} step={0.05} format={(v) => fmt(v)} onChange={(v) => userSet({ len: r2(v) })} />
          {props.rotatable && (
            <Slider label="סיבוב השלשה ההתחלתית φ" value={s.phi} min={-3.14} max={3.14} step={0.01} format={(v) => fmt(v)} onChange={(v) => userSet({ phi: r2(v) })} />
          )}
          {props.mirrorable && (
            <div class="group" role="group" aria-label="שיקוף">
              <Toggle label="τ ← −τ" on={s.flip} onChange={(v) => userSet({ flip: v })} />
            </div>
          )}
        </>
      }
    />
  );
}
