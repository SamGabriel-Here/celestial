/* =============================================================================
 * SunArc — daylight as a traced arc, with the sun sitting at the current time.
 * ========================================================================== */

import { formatTime, humanGap, nowSeconds } from '../lib/format';
import { daylightProgress } from '../lib/transform';

const LENGTH = Math.PI * 60;

export function SunArc({
  sunrise, sunset, tz, trace = false,
}: { sunrise: number | undefined; sunset: number | undefined; tz: number; trace?: boolean }) {
  const progress = daylightProgress(sunrise, sunset);
  const now = nowSeconds();
  const settled = progress ?? (sunrise && now < sunrise ? 0 : 1);
  // Only a sun that is actually up gets to travel; a set or unrisen sun just sits.
  const travels = trace && progress !== null;

  return (
    <div className="sun">
      <svg viewBox="0 0 160 84" className={travels ? 'sun__arc sun--trace' : 'sun__arc'} aria-hidden="true">
        <path className="sun__track" d="M20 66 A60 60 0 0 1 140 66" />
        <path className="sun__lit" d="M20 66 A60 60 0 0 1 140 66"
          style={{ strokeDasharray: LENGTH, strokeDashoffset: LENGTH * (1 - (progress ?? 0)) }} />
        {/*
          The sun sits at the sunrise end and the group turns about the arc's
          centre. Rotation keeps it on the curve at every frame; interpolating
          cx/cy would cut a straight chord beneath the arc.
        */}
        <g className="sun__body" style={{ transform: `rotate(${settled * 180}deg)` }}>
          <circle className="sun__dot" cx="20" cy="66" r="5.5" opacity={progress === null ? 0.4 : 1} />
        </g>
        <line className="sun__ground" x1="10" y1="72" x2="150" y2="72" />
      </svg>

      <div className="sun__times">
        <p><span className="label">Sunrise</span><span className="sun__time tnum">{sunrise ? formatTime(sunrise, tz) : '—'}</span></p>
        <p style={{ textAlign: 'right' }}><span className="label">Sunset</span><span className="sun__time tnum">{sunset ? formatTime(sunset, tz) : '—'}</span></p>
      </div>

      <p className="faint" style={{ textAlign: 'center', fontSize: '0.82rem' }}>{describe(sunrise, sunset)}</p>
    </div>
  );
}

function describe(sunrise: number | undefined, sunset: number | undefined): string {
  if (!sunrise || !sunset) return '';
  const now = nowSeconds();
  const length = `${humanGap(sunset - sunrise)} of daylight`;
  if (now < sunrise) return `${length} · sunrise in ${humanGap(sunrise - now)}`;
  if (now > sunset) return `${length} · the sun has set`;
  return `${length} · ${humanGap(sunset - now)} until sunset`;
}
