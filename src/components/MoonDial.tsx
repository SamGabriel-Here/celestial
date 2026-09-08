/* =============================================================================
 * MoonDial — tonight's moon: the lit face, its name, and where it sits in the
 * cycle. Phase comes from the clock, so it needs no API data.
 * ========================================================================== */

import { useId } from 'react';
import { MARIA, moonAt, shadowOffset } from '../lib/moon';

const R = 26;
const C = 32;

export function MoonFace({ size = 64, at }: { size?: number; at?: number }) {
  const maskId = useId();
  const shineId = useId();
  const moon = moonAt(at);

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="moon-face"
      role="img" aria-label={`${moon.name}, ${Math.round(moon.illumination * 100)} percent lit`}>
      <defs>
        <mask id={maskId}>
          <circle cx={C} cy={C} r={R} fill="#fff" />
          {/* Same-sized disc slid across the face leaves exactly the lit lune. */}
          <circle cx={C + shadowOffset(moon) * R} cy={C} r={R * 1.004} fill="#000" />
        </mask>
        <radialGradient id={shineId} cx="36%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="var(--gold)" />
        </radialGradient>
      </defs>

      {/* The unlit disc stays faintly visible, the way earthshine reads. */}
      <circle cx={C} cy={C} r={R} className="moon-face__dark" />

      <g mask={`url(#${maskId})`}>
        <circle cx={C} cy={C} r={R} fill={`url(#${shineId})`} />
        {MARIA.map(([x, y, r, alpha], i) => (
          <circle key={i} cx={C + x * R} cy={C + y * R} r={r * R} fill="#5c6a8a" opacity={alpha * 2.4} />
        ))}
      </g>
    </svg>
  );
}

export function MoonDial({ at }: { at?: number }) {
  const moon = moonAt(at);
  const days = (value: number) => (value < 1 ? 'tomorrow' : `in ${Math.round(value)} days`);

  return (
    <div className="moon">
      <div className="moon__head">
        <MoonFace size={92} at={at} />
        <div>
          <p className="moon__name">{moon.name}</p>
          <p className="muted moon__lit tnum">{Math.round(moon.illumination * 100)}% lit</p>
          <p className="faint moon__age tnum">Day {Math.floor(moon.age) + 1} of 29.5</p>
        </div>
      </div>

      {/* The cycle as a track: where tonight sits between one new moon and the next. */}
      <div className="moon__cycle">
        <div className="moon__track" role="img"
          aria-label={`${Math.round(moon.phase * 100)} percent through the lunar cycle`}>
          <span className="moon__fill" style={{ transform: `scaleX(${moon.phase})` }} />
          <span className="moon__marker" style={{ left: `${moon.phase * 100}%` }} />
        </div>
        <div className="moon__ticks faint">
          <span>New</span><span>First</span><span>Full</span><span>Last</span><span>New</span>
        </div>
      </div>

      <p className="faint moon__next">
        Full moon {days(moon.daysToFull)} · new moon {days(moon.daysToNew)}
      </p>
    </div>
  );
}
