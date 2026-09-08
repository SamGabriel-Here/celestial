/* =============================================================================
 * icons.tsx — inline SVG. Weather glyphs map from OpenWeather's icon codes;
 * everything inherits currentColor so it works on any sky.
 * ========================================================================== */

import type { ReactNode, SVGProps } from 'react';

const CLOUD = 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z';
const CLOUD_TOP = 'M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25';

const SUN_RAYS = (
  <>
    <line x1="12" y1="1.6" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22.4" />
    <line x1="4.3" y1="4.3" x2="6" y2="6" /><line x1="18" y1="18" x2="19.7" y2="19.7" />
    <line x1="1.6" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22.4" y2="12" />
    <line x1="4.3" y1="19.7" x2="6" y2="18" /><line x1="18" y1="6" x2="19.7" y2="4.3" />
  </>
);

const WEATHER: Record<string, ReactNode> = {
  'clear-day': <><circle cx="12" cy="12" r="4.6" className="ic-sun" />{SUN_RAYS}</>,
  'clear-night': <path className="ic-sun" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  'partly-day': (
    <>
      <circle cx="6.6" cy="6.4" r="2.5" className="ic-sun" />
      <line x1="6.6" y1="1.3" x2="6.6" y2="2.5" /><line x1="1.5" y1="6.4" x2="2.7" y2="6.4" />
      <line x1="2.95" y1="2.75" x2="3.8" y2="3.6" /><line x1="10.25" y1="2.75" x2="9.4" y2="3.6" />
      <line x1="2.95" y1="10.05" x2="3.8" y2="9.2" />
      <g transform="translate(4.6 7.6) scale(0.66)"><path d={CLOUD} /></g>
    </>
  ),
  'partly-night': (
    <>
      <g transform="translate(1 0.6) scale(0.42)" className="ic-sun">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </g>
      <g transform="translate(4.6 7.6) scale(0.66)"><path d={CLOUD} /></g>
    </>
  ),
  cloudy: <g transform="translate(0 1) scale(0.92)"><path d={CLOUD} /></g>,
  overcast: (
    <>
      <g transform="translate(11 0.6) scale(0.4)" opacity="0.5"><path d={CLOUD} /></g>
      <g transform="translate(0.5 4) scale(0.78)"><path d={CLOUD} /></g>
    </>
  ),
  drizzle: (
    <>
      <path d={CLOUD_TOP} />
      <line x1="8" y1="17" x2="7.2" y2="19.4" /><line x1="12" y1="18.4" x2="11.2" y2="20.8" />
      <line x1="16" y1="17" x2="15.2" y2="19.4" />
    </>
  ),
  rain: (
    <>
      <path d={CLOUD_TOP} />
      <line x1="8" y1="16" x2="6.6" y2="20.4" /><line x1="12.4" y1="17.4" x2="11" y2="21.8" />
      <line x1="16.8" y1="16" x2="15.4" y2="20.4" />
    </>
  ),
  storm: (
    <>
      <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" />
      <polyline className="ic-bolt" points="13 11 9 17 15 17 11 23" />
    </>
  ),
  snow: (
    <>
      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
      <line x1="8" y1="17" x2="8.01" y2="17" /><line x1="8" y1="21" x2="8.01" y2="21" />
      <line x1="12" y1="19" x2="12.01" y2="19" /><line x1="12" y1="23" x2="12.01" y2="23" />
      <line x1="16" y1="17" x2="16.01" y2="17" /><line x1="16" y1="21" x2="16.01" y2="21" />
    </>
  ),
  mist: <><path d="M3 7.5h13" /><path d="M6.5 12h14" /><path d="M3 16.5h11" /><path d="M9 21h9" /></>,
};

export function conditionFromCode(code = ''): string {
  const group = code.slice(0, 2);
  const night = code.endsWith('n');
  switch (group) {
    case '01': return night ? 'clear-night' : 'clear-day';
    case '02': return night ? 'partly-night' : 'partly-day';
    case '03': return 'cloudy';
    case '04': return 'overcast';
    case '09': return 'drizzle';
    case '10': return 'rain';
    case '11': return 'storm';
    case '13': return 'snow';
    case '50': return 'mist';
    default: return night ? 'clear-night' : 'clear-day';
  }
}

interface GlyphProps extends SVGProps<SVGSVGElement> { size?: number; title?: string }

export function WeatherIcon({ code, size = 32, title, ...rest }: GlyphProps & { code: string }) {
  const name = conditionFromCode(code);
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
      className={`icon icon--weather is-${name}`}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true, focusable: false })}
      {...rest}
    >
      {WEATHER[name] ?? WEATHER['clear-day']}
    </svg>
  );
}

/* --- Interface glyphs ---------------------------------------------------- */

const UI: Record<string, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7.5" /><line x1="21" y1="21" x2="16.8" y2="16.8" /></>,
  pin: <><path d="M20 10c0 6.5-8 12.5-8 12.5S4 16.5 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="2.8" /></>,
  sun: <><circle cx="12" cy="12" r="4.6" />{SUN_RAYS}</>,
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  thermometer: <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />,
  droplet: <path d="M12 2.7l5.66 5.65a8 8 0 1 1-11.32 0z" />,
  wind: <path d="M9.6 4.6A2 2 0 1 1 11 8H2m10.6 11.4A2 2 0 1 0 14 16H2m15.7-8.3A2.5 2.5 0 1 1 19.5 12H2" />,
  gauge: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  eye: <><path d="M1.5 12S5.6 4.5 12 4.5 22.5 12 22.5 12 18.4 19.5 12 19.5 1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  cloud: <path d={CLOUD} />,
  sunrise: <><path d="M17 18a5 5 0 0 0-10 0" /><line x1="12" y1="2.5" x2="12" y2="9" /><polyline points="8.5 6 12 2.5 15.5 6" /><line x1="2" y1="22" x2="22" y2="22" /></>,
  sunset: <><path d="M17 18a5 5 0 0 0-10 0" /><line x1="12" y1="2.5" x2="12" y2="9" /><polyline points="8.5 5.5 12 9 15.5 5.5" /><line x1="2" y1="22" x2="22" y2="22" /></>,
  leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></>,
  refresh: <><polyline points="21 3.5 21 9.5 15 9.5" /><polyline points="3 20.5 3 14.5 9 14.5" /><path d="M18.5 9.5A7.5 7.5 0 0 0 5.6 6.6L3 9.5m18 5l-2.6 2.9A7.5 7.5 0 0 1 5.5 14.5" /></>,
  alert: <><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13.5" /><line x1="12" y1="17.2" x2="12.01" y2="17.2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2.5" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></>,
  sliders: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
  close: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
};

export function Icon({ name, size = 18, title, ...rest }: GlyphProps & { name: keyof typeof UI }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="icon"
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true, focusable: false })}
      {...rest}
    >
      {UI[name]}
    </svg>
  );
}

/** The Celestial mark. Mixes fill and stroke, so it gets its own component. */
export function BrandMark({ size = 28, title = 'Celestial' }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" role="img" aria-label={title} className="brand-mark">
      <path d="M32 9 A17 17 0 1 1 16.02 20.19" stroke="currentColor" strokeWidth="4.4" strokeLinecap="round" />
      <path className="ic-sun" fill="currentColor"
        d="M22.2 6.1 Q23.1 11.2 28.2 12.1 Q23.1 13 22.2 18.1 Q21.3 13 16.2 12.1 Q21.3 11.2 22.2 6.1 Z" />
      <g fill="currentColor">
        <circle cx="17" cy="44" r="9.5" /><circle cx="32" cy="40" r="12.5" />
        <circle cx="45.4" cy="44.5" r="9" /><rect x="17" y="44" width="28.4" height="9.5" />
      </g>
    </svg>
  );
}
