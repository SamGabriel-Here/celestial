import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Column } from '../lib/columns';
import { createSection, GUTTER, RULER, type SectionApi } from './render';

const PHONE = '(max-width: 900px)';
const PHONE_COL = 44;

function useMedia(q: string) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

interface Props {
  cols: Column[];
  kind: 'hours' | 'days';
  cursor: number;
  onCursor(i: number): void;
  fmtTemp(c: number): string;
  label: string;
  valueText(c: Column): string;
  readout(c: Column): ReactNode;
  table: ReactNode;
}

export function Section({ cols, kind, cursor, onCursor, fmtTemp, label, valueText, readout, table }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const api = useRef<SectionApi | null>(null);
  const phone = useMedia(PHONE);
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const [width, setWidth] = useState(0);
  const i = Math.min(cursor, Math.max(0, cols.length - 1));
  const latest = useRef(i); // key repeat can outrun a re-render; always step from the newest index
  latest.current = i;

  useEffect(() => {
    api.current = createSection(canvas.current!);
    return () => api.current?.destroy();
  }, []);

  useEffect(() => {
    let live = true;
    document.fonts.ready.then(() => { if (live) api.current?.setData(cols, { kind, reduced, fmtTemp }); });
    return () => { live = false; };
  }, [cols, kind, reduced, fmtTemp, phone]);

  useEffect(() => api.current?.setCursor(i), [i]);

  useLayoutEffect(() => {
    const el = canvas.current!;
    const ro = new ResizeObserver(() => { setWidth(el.clientWidth); api.current?.resize(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // On a phone, keep the cursor's column in view.
  useEffect(() => {
    if (!phone || !scroller.current) return;
    const s = scroller.current, x = i * PHONE_COL;
    if (x < s.scrollLeft || x > s.scrollLeft + s.clientWidth - PHONE_COL) s.scrollTo({ left: x - PHONE_COL, behavior: reduced ? 'auto' : 'smooth' });
  }, [i, phone, reduced]);

  const colW = cols.length ? (width - GUTTER) / cols.length : 0;
  const at = (clientX: number) => {
    const r = canvas.current!.getBoundingClientRect();
    return Math.max(0, Math.min(cols.length - 1, Math.floor((clientX - r.left) / Math.max(1, colW))));
  };
  const c = cols[i];

  return (
    <div className="section">
      <div ref={scroller} className="section-scroll"
        role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={Math.max(0, cols.length - 1)}
        aria-valuenow={i} aria-valuetext={c ? valueText(c) : undefined}
        onKeyDown={(e) => {
          const step = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[e.key];
          if (step === undefined) return;
          e.preventDefault();
          const next = Math.max(0, Math.min(cols.length - 1, step === Infinity ? cols.length - 1 : step === -Infinity ? 0 : latest.current + step));
          latest.current = next;
          onCursor(next);
        }}
        onPointerMove={(e) => { if (e.pointerType === 'mouse') onCursor(at(e.clientX)); }}
        onPointerDown={(e) => { if (e.pointerType !== 'mouse') onCursor(at(e.clientX)); }}>
        <div className="section-track" style={phone ? { width: cols.length * PHONE_COL + GUTTER } : undefined}>
          <canvas ref={canvas} aria-hidden="true" />
          {c && (
            <div className={`readout${i > cols.length * 0.62 ? ' flip' : ''}`} style={{ left: (i + 0.5) * colW, top: RULER + 12 }}>
              {readout(c)}
            </div>
          )}
        </div>
      </div>
      <div className="sr">{table}</div>
    </div>
  );
}
