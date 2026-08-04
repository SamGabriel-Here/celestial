/* =============================================================================
 * format.js — pure presentation helpers. No DOM, no network.
 * All times are rendered in the *searched city's* local time, not the viewer's.
 * ========================================================================== */

/**
 * OpenWeather gives a fixed UTC offset in seconds per city. Shifting the epoch
 * and then formatting in UTC gives us that city's wall-clock time.
 */
function zoned(unixSeconds, offsetSeconds) {
  return new Date((unixSeconds + offsetSeconds) * 1000);
}

function fmt(unixSeconds, offsetSeconds, options) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(
    zoned(unixSeconds, offsetSeconds)
  );
}

export const formatTime = (unix, offset) => fmt(unix, offset, { hour: 'numeric', minute: '2-digit' });

export const formatHour = (unix, offset) => fmt(unix, offset, { hour: 'numeric' });

export const formatWeekday = (unix, offset) => fmt(unix, offset, { weekday: 'short' });

export const formatDayMonth = (unix, offset) => fmt(unix, offset, { day: 'numeric', month: 'short' });

export const formatFullDate = (unix, offset) =>
  fmt(unix, offset, { weekday: 'long', day: 'numeric', month: 'long' });

/** YYYY-MM-DD in the city's local time — used as a grouping key. */
export const zonedDateKey = (unix, offset) => zoned(unix, offset).toISOString().slice(0, 10);

/** Current UTC seconds, for "is this today?" and elapsed-time maths. */
export const nowSeconds = () => Math.floor(Date.now() / 1000);

/* --- Units -------------------------------------------------------------- */

export const UNITS = { METRIC: 'metric', IMPERIAL: 'imperial' };

const toFahrenheit = (c) => (c * 9) / 5 + 32;

/** Temperature value only, already rounded — pair with `degreeLabel`. */
export function temp(celsius, unit) {
  if (celsius === undefined || celsius === null || Number.isNaN(celsius)) return '—';
  return String(Math.round(unit === UNITS.IMPERIAL ? toFahrenheit(celsius) : celsius));
}

export const degreeLabel = (unit) => (unit === UNITS.IMPERIAL ? '°F' : '°C');

/** Temperature with its degree symbol, e.g. "18°". */
export const tempShort = (celsius, unit) => `${temp(celsius, unit)}°`;

/** OpenWeather metric wind is m/s. Show km/h or mph. */
export function wind(metresPerSecond, unit) {
  if (metresPerSecond === undefined || metresPerSecond === null) return { value: '—', unit: '' };
  return unit === UNITS.IMPERIAL
    ? { value: Math.round(metresPerSecond * 2.23694), unit: 'mph' }
    : { value: Math.round(metresPerSecond * 3.6), unit: 'km/h' };
}

/** Visibility arrives in metres and caps at 10 km. */
export function visibility(metres, unit) {
  if (metres === undefined || metres === null) return { value: '—', unit: '' };
  return unit === UNITS.IMPERIAL
    ? { value: (metres / 1609.34).toFixed(1), unit: 'mi' }
    : { value: (metres / 1000).toFixed(1), unit: 'km' };
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function compass(degrees) {
  if (degrees === undefined || degrees === null) return '';
  return COMPASS[Math.round(degrees / 22.5) % 16];
}

export const percent = (value) => (value === undefined || value === null ? '—' : `${Math.round(value)}%`);

/* --- Misc --------------------------------------------------------------- */

/** "just now" / "4 min ago" / "2 hr ago" for the last-updated stamp. */
export function relativeTime(fromMs, nowMs = Date.now()) {
  const seconds = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}

/** "Paris, FR" — state included only when it adds information. */
export function placeLabel(place) {
  const parts = [place.name];
  if (place.state && place.state !== place.name) parts.push(place.state);
  if (place.country) parts.push(place.country);
  return parts.join(', ');
}

export const titleCase = (text = '') => text.replace(/\b\p{L}/gu, (char) => char.toUpperCase());

export const AQI_LEVELS = {
  1: { label: 'Good', tone: 'good', note: 'Air quality is satisfactory.' },
  2: { label: 'Fair', tone: 'fair', note: 'Acceptable for most people.' },
  3: { label: 'Moderate', tone: 'moderate', note: 'Sensitive groups should take care.' },
  4: { label: 'Poor', tone: 'poor', note: 'Limit prolonged outdoor exertion.' },
  5: { label: 'Very poor', tone: 'severe', note: 'Avoid outdoor activity if you can.' },
};
