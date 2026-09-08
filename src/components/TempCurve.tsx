/* =============================================================================
 * TempCurve — the hourly temperature line.
 *
 * Plain SVG rather than a charting library: one series, no interaction beyond
 * hover, and a dependency here would outweigh the maths.
 * ========================================================================== */

import { useId } from 'react';
import { formatHour, temp, type Unit } from '../lib/format';
import type { Hour } from '../lib/transform';

const W = 720;
const H = 190;
const PAD = { top: 34, right: 18, bottom: 30, left: 18 };

export function TempCurve({ hours, unit }: { hours: Hour[]; unit: Unit }) {
  const gradientId = useId();
  if (hours.length < 2) return null;

  const temps = hours.map((h) => h.temp);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = Math.max(max - min, 1);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (hours.length - 1)) * plotW;
  const y = (t: number) => PAD.top + (1 - (t - min) / span) * plotH;

  // Catmull-Rom-ish smoothing: midpoint quadratics keep it monotone-safe.
  const line = hours
    .map((h, i) => {
      const px = x(i);
      const py = y(h.temp);
      if (i === 0) return `M${px} ${py}`;
      const prevX = x(i - 1);
      const prevY = y(hours[i - 1]!.temp);
      const midX = (prevX + px) / 2;
      return `C${midX} ${prevY} ${midX} ${py} ${px} ${py}`;
    })
    .join(' ');

  const area = `${line} L${x(hours.length - 1)} ${H - PAD.bottom} L${x(0)} ${H - PAD.bottom} Z`;

  return (
    <svg className="curve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
      aria-label={`Temperature from ${temp(min, unit)} to ${temp(max, unit)} degrees over the next ${hours.length * 3} hours`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.42" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

      {hours.map((hour, i) => (
        <g key={hour.dt}>
          <circle cx={x(i)} cy={y(hour.temp)} r="3.5" fill="var(--brand)"
            stroke="var(--glass-2)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <text className="curve__temp tnum" x={x(i)} y={y(hour.temp) - 14} textAnchor="middle">
            {temp(hour.temp, unit)}°
          </text>
          <text className="curve__hour tnum" x={x(i)} y={H - 10} textAnchor="middle">
            {i === 0 ? 'Now' : formatHour(hour.dt, hour.tz)}
          </text>
        </g>
      ))}
    </svg>
  );
}
