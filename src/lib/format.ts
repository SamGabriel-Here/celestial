/* =============================================================================
 * format.ts — pure presentation helpers.
 * Every time is rendered in the *searched city's* local time, never the viewer's.
 * ========================================================================== */

/** OpenWeather gives a fixed UTC offset per city; shift the epoch, format in UTC. */
const zoned = (unix: number, offset: number) => new Date((unix + offset) * 1000);

const fmt = (unix: number, offset: number, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(zoned(unix, offset));

export const formatTime = (u: number, o: number) => fmt(u, o, { hour: 'numeric', minute: '2-digit' });
export const formatHour = (u: number, o: number) => fmt(u, o, { hour: 'numeric' });
export const formatWeekday = (u: number, o: number) => fmt(u, o, { weekday: 'short' });
export const formatWeekdayLong = (u: number, o: number) => fmt(u, o, { weekday: 'long' });
export const formatDayMonth = (u: number, o: number) => fmt(u, o, { day: 'numeric', month: 'short' });
export const formatFullDate = (u: number, o: number) =>
  fmt(u, o, { weekday: 'long', day: 'numeric', month: 'long' });

/** YYYY-MM-DD in the city's local time — the grouping key for daily roll-ups. */
export const zonedDateKey = (unix: number, offset: number) =>
  zoned(unix, offset).toISOString().slice(0, 10);

/** Hour of day (0–23) in the city's local time. */
export const zonedHour = (unix: number, offset: number) => zoned(unix, offset).getUTCHours();

export const nowSeconds = () => Math.floor(Date.now() / 1000);

/* --- Units -------------------------------------------------------------- */

export type Unit = 'metric' | 'imperial';

const toFahrenheit = (c: number) => (c * 9) / 5 + 32;

export function temp(celsius: number | undefined, unit: Unit): string {
  if (celsius === undefined || Number.isNaN(celsius)) return '—';
  return String(Math.round(unit === 'imperial' ? toFahrenheit(celsius) : celsius));
}

export const degreeLabel = (unit: Unit) => (unit === 'imperial' ? '°F' : '°C');
export const tempShort = (c: number | undefined, unit: Unit) => `${temp(c, unit)}°`;

/** OpenWeather metric wind is m/s; show km/h or mph. */
export function wind(ms: number | undefined, unit: Unit): { value: string; unit: string } {
  if (ms === undefined) return { value: '—', unit: '' };
  return unit === 'imperial'
    ? { value: String(Math.round(ms * 2.23694)), unit: 'mph' }
    : { value: String(Math.round(ms * 3.6)), unit: 'km/h' };
}

/** Visibility arrives in metres and caps at 10 km. */
export function visibility(metres: number | undefined, unit: Unit): { value: string; unit: string } {
  if (metres === undefined) return { value: '—', unit: '' };
  return unit === 'imperial'
    ? { value: (metres / 1609.34).toFixed(1), unit: 'mi' }
    : { value: (metres / 1000).toFixed(1), unit: 'km' };
}

const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'] as const;

export const compass = (deg: number | undefined) =>
  deg === undefined ? '' : (COMPASS[Math.round(deg / 22.5) % 16] as string);

/** "just now" / "4 min ago" / "2 hr ago". */
export function relativeTime(fromMs: number, nowMs = Date.now()): string {
  const seconds = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} hr ago`;
}

/** "3h 20m" / "45 min", rounding hours and minutes together. */
export function humanGap(seconds: number): string {
  const total = Math.round(seconds / 60);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours === 0 ? `${minutes} min` : `${hours}h ${minutes}m`;
}

export const titleCase = (text = '') => text.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

export interface Place {
  name: string;
  country: string;
  state: string;
  lat: number;
  lon: number;
}

/** "Lisbon, PT" — state included only when it adds information. */
export function placeLabel(place: Place): string {
  const parts = [place.name];
  if (place.state && place.state !== place.name) parts.push(place.state);
  if (place.country) parts.push(place.country);
  return parts.join(', ');
}

export const AQI_LEVELS = {
  1: { label: 'Good', tone: 'good', note: 'Air quality is satisfactory.' },
  2: { label: 'Fair', tone: 'fair', note: 'Acceptable for most people.' },
  3: { label: 'Moderate', tone: 'moderate', note: 'Sensitive groups should take care.' },
  4: { label: 'Poor', tone: 'poor', note: 'Limit prolonged outdoor exertion.' },
  5: { label: 'Very poor', tone: 'severe', note: 'Avoid outdoor activity if you can.' },
} as const;

export type AqiLevel = keyof typeof AQI_LEVELS;
