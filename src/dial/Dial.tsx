import { useEffect, useRef, useState, type ReactNode } from 'react';
import { indexFromDrag, pointerAngle, segmentAngle } from '../lib/dial';

export interface Segment {
  key: string;
  top: string; // small line (hour, weekday)
  bottom: string; // value line (temperature)
  spoke?: number; // 0..1 length of the rain spoke
  spokeAlpha?: number; // 0..1 strength (chance)
  mark?: boolean; // a yellow dot: today, latest, now
}

interface Props {
  segments: Segment[];
  index: number;
  onIndex(i: number): void;
  label: string;
  valueText: string;
  children: ReactNode; // the window
}

// SVG units: the rim is drawn in a 1000×1000 box centred on 0,0.
const R_WIN = 330, R_RIM = 470, R_LABEL = 432;
const TURN = 'transform 900ms cubic-bezier(.16, 1, .3, 1)';

export function Dial({ segments, index, onIndex, label, valueText, children }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ start: number; deg: number } | null>(null);
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
  const transition = reduced ? 'none' : TURN;

  const step = (to: number) => onIndex(Math.max(0, Math.min(n - 1, to)));

  // Wheel scrolling turns the rim; needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = svg.current!;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); step(latest.current + Math.sign(e.deltaY || e.deltaX)); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // Deps deliberately narrow: `step` reads the latest index through the ref.
  }, [n]);

  const angleOf = (e: React.PointerEvent) => {
    const b = svg.current!.getBoundingClientRect();
    return pointerAngle(e.clientX, e.clientY, b.left + b.width / 2, b.top + b.height / 2);
  };

  return (
    <div className="dial">
      <div className="dial-window">{children}</div>
      <svg ref={svg} className="dial-rim" viewBox="-500 -500 1000 1000" role="slider" tabIndex={0}
        aria-label={label} aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={index} aria-valuetext={valueText}
        onPointerDown={(e) => { svg.current!.setPointerCapture(e.pointerId); drag.current = { start: index, deg: angleOf(e) }; }}
        onPointerMove={(e) => { if (drag.current) { const i = indexFromDrag(drag.current.start, drag.current.deg, angleOf(e), n); if (i !== latest.current) onIndex(i); } }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={(e) => {
          const k: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 6, PageDown: -6 };
          if (e.key === 'Home') { e.preventDefault(); return step(0); }
          if (e.key === 'End') { e.preventDefault(); return step(n - 1); }
          if (k[e.key] !== undefined) { e.preventDefault(); step(latest.current + k[e.key]!); }
        }}>
        <circle r={R_WIN} className="ring-window" />
        <circle r={R_RIM} className="ring-outer" />
        <circle r={R_RIM - 74} className="ring-inner" />
        <g style={{ transform: `rotate(${rotation}deg)`, transition }}>
          {segments.map((s, i) => {
            const a = i * seg, rad = (a * Math.PI) / 180, sx = Math.sin(rad), cy = -Math.cos(rad);
            const r0 = R_WIN + 10;
            const len = 14 + (s.spoke ?? 0) * 52;
            return (
              <g key={s.key}>
                <line x1={sx * r0} y1={cy * r0} x2={sx * (r0 + 9)} y2={cy * (r0 + 9)} className="tick" />
                {s.spoke !== undefined && s.spoke > 0 && (
                  <line x1={sx * (r0 + 15)} y1={cy * (r0 + 15)} x2={sx * (r0 + 15 + len)} y2={cy * (r0 + 15 + len)}
                    className="spoke" style={{ opacity: 0.3 + (s.spokeAlpha ?? 0.5) * 0.7 }} />
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
        <line x1={0} y1={-R_WIN} x2={0} y2={-R_RIM - 10} className="pointer-line" />
        <path d={`M0 ${-R_RIM - 12} l-13 -24 h26 z`} className="pointer" />
      </svg>
    </div>
  );
}
