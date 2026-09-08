/* =============================================================================
 * parts.tsx — the small shared pieces. Anything used by two or more views.
 * ========================================================================== */

import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './icons';
import { relativeTime } from '../lib/format';

export function Metric({
  glyph, label, value, unit, hint,
}: { glyph: string; label: string; value: ReactNode; unit?: string; hint?: string }) {
  return (
    <li className="metric">
      <span className="metric__top">
        <Icon name={glyph as never} size={14} />
        <span className="label">{label}</span>
      </span>
      <span className="metric__value tnum">
        {value}
        {unit ? <i>{unit}</i> : null}
      </span>
      {hint ? <span className="metric__hint">{hint}</span> : null}
    </li>
  );
}

/** "Updated 4 min ago", ticking without re-rendering anything else. */
export function Stamp({ at }: { at: number }) {
  const [, bump] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => bump((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="faint">Updated {relativeTime(at)}</span>;
}

export function SectionHeading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <header className="section-head">
      <h2 className="h-section">{title}</h2>
      {aside ? <div className="section-head__aside">{aside}</div> : null}
    </header>
  );
}

/** A horizontal 0–1 meter; used for precipitation, humidity and AQI. */
export function Meter({ value, tone = 'var(--brand)' }: { value: number; tone?: string }) {
  return (
    <span className="meter" role="presentation">
      <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, value))})`, background: tone }} />
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="faint" style={{ padding: '1.5rem 0', textAlign: 'center' }}>{children}</p>;
}
