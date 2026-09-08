/* =============================================================================
 * SunArc — daylight as a traced arc, with the sun sitting at the current time.
 * ========================================================================== */

import { formatTime, humanGap, nowSeconds } from '../lib/format';
import { daylightProgress } from '../lib/transform';

const LENGTH = Math.PI * 60;

export function SunArc({
  sunrise, sunset, tz,
}: { sunrise: number | undefined; sunset: number | undefined; tz: number }) {
  const progress = daylightProgress(sunrise, sunset);
  const now = nowSeconds();
  const settled = progress ?? (sunrise && now < sunrise ? 0 : 1);

  const dotX = 80 - 60 * Math.cos(Math.PI * settled);
  const dotY = 66 - 60 * Math.sin(Math.PI * settled);

  return (
    <div className="sun">
      <svg viewBox="0 0 160 84" className="sun__arc" aria-hidden="true">
        <path className="sun__track" d="M20 66 A60 60 0 0 1 140 66" />
        <path className="sun__lit" d="M20 66 A60 60 0 0 1 140 66"
          style={{ strokeDasharray: LENGTH, strokeDashoffset: LENGTH * (1 - (progress ?? 0)) }} />
        <circle className="sun__dot" cx={dotX} cy={dotY} r="5.5" opacity={progress === null ? 0.4 : 1} />
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
