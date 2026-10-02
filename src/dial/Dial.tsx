import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { dragStart, dragTo, pointerAngle, segmentAngle, wheelSteps, type Drag } from '../lib/dial';

export interface Segment {
  key: string;
  top: string; // small line (hour, weekday)
  bottom: string; // value line (temperature)
  spoke?: number; // 0..1 length of the rain spoke
  spokeAlpha?: number; // 0..1 strength (chance)
  mark?: boolean; // a yellow dot: today, latest, now
  tone?: 'rain' | 'moon'; // spoke colour: rain amount, or the moon's illumination
  band?: string; // the segment's sky colour on the rim's track (day, twilight, night)
}

interface Props {
  segments: Segment[];
  index: number;
  onIndex(i: number): void;
  label: string;
  valueText: string;
  children: ReactNode; // the window
  turnMs?: number; // how fast the rim turns to a new selection
  glow?: string; // the colour of the selected moment's sky, lit behind the instrument
}

// SVG units: the rim is drawn in a 1000×1000 box centred on 0,0.
const R_WIN = 330, R_RIM = 470, R_LABEL = 432, R_DISC = 478, R_BAND = 396;

/** A ring between two radii: the disc the rim is printed on, with the window cut out. */
const annulus = (outer: number, inner: number) =>
  `M${outer} 0A${outer} ${outer} 0 1 0 ${-outer} 0A${outer} ${outer} 0 1 0 ${outer} 0Z` +
  `M${inner} 0A${inner} ${inner} 0 1 0 ${-inner} 0A${inner} ${inner} 0 1 0 ${inner} 0Z`;

/** One segment's wedge of the rim's track, centred on angle `a` (degrees from the top). */
function wedge(a: number, seg: number, r1: number, r2: number) {
  const p = (deg: number, r: number) => `${(r * Math.sin((deg * Math.PI) / 180)).toFixed(2)} ${(-r * Math.cos((deg * Math.PI) / 180)).toFixed(2)}`;
  const a0 = a - seg / 2, a1 = a + seg / 2;
  return `M${p(a0, r1)}A${r1} ${r1} 0 0 1 ${p(a1, r1)}L${p(a1, r2)}A${r2} ${r2} 0 0 0 ${p(a0, r2)}Z`;
}

/** The fixed degree scale printed on the card around the disc: every 5°, long every 30°. */
const DEGREES = Array.from({ length: 72 }, (_, i) => i * 5);

export function Dial({ segments, index, onIndex, label, valueText, children, turnMs = 900, glow }: Props) {
  const uid = useId().replace(/:/g, '');
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const wheel = useRef(0);
  const latest = useRef(index);
  latest.current = index;
  const n = Math.max(1, segments.length);
  const seg = segmentAngle(n);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The one authored moment: on first paint the rim swings a quarter turn into place.
  const [settled, setSettled] = useState(reduced);
  useEffect(() => {
    if (settled) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setSettled(true)));
    return () => cancelAnimationFrame(id);
  }, [settled]);
  const rotation = -index * seg + (settled ? 0 : 90);
  // The load swing is always the slow one; later turns use the view's pace.
  const transition = reduced ? 'none' : `transform ${settled ? turnMs : 900}ms cubic-bezier(.16, 1, .3, 1)`;

  const step = (to: number) => {
    const i = Math.max(0, Math.min(n - 1, to));
    if (i !== latest.current) onIndex(i); // no update, and no address-bar write, when nothing moves
  };

  // Wheel scrolling turns the rim; needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = svg.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = wheelSteps(wheel.current, e.deltaY || e.deltaX);
      wheel.current = r.acc;
      if (r.steps) step(latest.current + r.steps);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // Deps deliberately narrow: `step` reads the latest index through the ref.
  }, [n]);

  const angleOf = (e: React.PointerEvent) => {
    const b = svg.current!.getBoundingClientRect();
    return pointerAngle(e.clientX, e.clientY, b.left + b.width / 2, b.top + b.height / 2);
  };

  return (
    <div className="dial" style={glow ? ({ '--glow': glow } as CSSProperties) : undefined}>
      <div className="dial-glow" aria-hidden="true" />
      <div className="dial-window">{children}</div>
      <svg ref={svg} className="dial-rim" viewBox="-500 -500 1000 1000" role="slider" tabIndex={0}
        aria-label={label} aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={index} aria-valuetext={valueText}
        onKeyDown={(e) => {
          const k: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 6, PageDown: -6 };
          if (e.key === 'Home') { e.preventDefault(); return step(0); }
          if (e.key === 'End') { e.preventDefault(); return step(n - 1); }
          if (k[e.key] !== undefined) { e.preventDefault(); step(latest.current + k[e.key]!); }
        }}>
        <defs>
          <filter id={`lift${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#050c2e" floodOpacity=".55" />
          </filter>
          <linearGradient id={`bevel${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".38" />
            <stop offset=".5" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#020824" stopOpacity=".35" />
          </linearGradient>
        </defs>
        <g className="degree-scale" aria-hidden="true">
          {DEGREES.map((d) => {
            const rad = (d * Math.PI) / 180, long = d % 30 === 0, r1 = long ? 483 : 486, r2 = long ? 499 : 493;
            return <line key={d} x1={r1 * Math.sin(rad)} y1={-r1 * Math.cos(rad)} x2={r2 * Math.sin(rad)} y2={-r2 * Math.cos(rad)} className={long ? 'long' : undefined} />;
          })}
        </g>
        {/* The rim is a disc lifted off the card, with the sky window cut through it. */}
        <path d={annulus(R_DISC, R_WIN)} fillRule="evenodd" className="disc" filter={`url(#lift${uid})`} />
        <circle r={R_DISC - 1.5} fill="none" stroke={`url(#bevel${uid})`} strokeWidth="3" />
        <circle r={R_WIN} className="ring-window" />
        <circle r={R_RIM} className="ring-outer" />
        {/* Only the printed rim turns: the sky window and the centre let the page scroll. */}
        <circle r={(R_WIN + R_RIM + 30) / 2} strokeWidth={R_RIM + 30 - R_WIN} className="grip"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = dragStart(latest.current, angleOf(e)); }}
          onPointerMove={(e) => { if (!drag.current) return; const r = dragTo(drag.current, angleOf(e), n); drag.current = r.state; step(r.index); }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }} />
        <circle r={R_RIM - 74} className="ring-inner" />
        <g style={{ transform: `rotate(${rotation}deg)`, transition }}>
          {segments.some((s) => s.band) && segments.map((s, i) => s.band && (
            <path key={`b${s.key}`} d={wedge(i * seg, seg, R_WIN + 2, R_BAND)} className="band" style={{ fill: s.band }} />
          ))}
          {segments.map((s, i) => {
            const a = i * seg, rad = (a * Math.PI) / 180, sx = Math.sin(rad), cy = -Math.cos(rad);
            const r0 = R_WIN + 10;
            const len = 14 + (s.spoke ?? 0) * 52;
            return (
              <g key={s.key}>
                <line x1={sx * r0} y1={cy * r0} x2={sx * (r0 + 9)} y2={cy * (r0 + 9)} className="tick" />
                {[1, 2, 3].map((q) => {
                  const fr = ((a + (q * seg) / 4) * Math.PI) / 180;
                  return <line key={q} x1={Math.sin(fr) * r0} y1={-Math.cos(fr) * r0} x2={Math.sin(fr) * (r0 + 5)} y2={-Math.cos(fr) * (r0 + 5)} className="tick-fine" />;
                })}
                {s.spoke !== undefined && s.spoke > 0 && (
                  <line x1={sx * (r0 + 15)} y1={cy * (r0 + 15)} x2={sx * (r0 + 15 + len)} y2={cy * (r0 + 15 + len)}
                    className={`spoke ${s.tone ?? 'rain'}`} style={{ opacity: 0.3 + (s.spokeAlpha ?? 0.5) * 0.7 }} />
                )}
                <g transform={`translate(${sx * R_LABEL} ${cy * R_LABEL})`}>
                  <g className="label" style={{ transform: `rotate(${-rotation}deg)`, transition }}>
                    <text y={-6} className={`top${i === index ? ' on' : ''}`}>{s.top}</text>
                    <text y={16} className={`bottom${i === index ? ' on' : ''}`}>{s.bottom}</text>
                    {s.mark && <circle cy={-30} r={4} className="mark" />}
                  </g>
                </g>
              </g>
            );
          })}
        </g>
        <line x1={0} y1={-R_WIN} x2={0} y2={-(R_LABEL - 38)} className="pointer-line" />
        <path d={`M0 ${-R_RIM - 12} l-13 -24 h26 z`} className="pointer" />
      </svg>
    </div>
  );
}
