export type Unit = 'c' | 'f';
export type Compass = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export const toUnit = (c: number, u: Unit): number => (u === 'f' ? (c * 9) / 5 + 32 : c);

export function fmtTemp(c: number, u: Unit): string {
  const n = Math.round(toUnit(c, u));
  return `${n === 0 ? 0 : n}°`; // Math.round(-0.4) is -0
}

const POINTS: Compass[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compass = (deg: number): Compass => POINTS[Math.round(deg / 45) % 8] as Compass;

export const fmtWind = (kmh: number): string => `${Math.round(kmh)} km/h`;

// Open-Meteo returns local wall-clock ISO strings ("2026-10-01T07:00"); labels are read
// straight from them so the viewer's time zone and DST shifts never leak in.
export const clockLabel = (iso: string): string => iso.slice(11, 16);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function weekday(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] as string;
}

const WMO: Record<number, string> = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'rime fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 56: 'freezing drizzle', 57: 'freezing drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains', 80: 'showers', 81: 'showers',
  82: 'violent showers', 85: 'snow showers', 86: 'snow showers', 95: 'thunderstorm', 96: 'thunderstorm with hail',
  99: 'thunderstorm with hail',
};
/** WMO weather code in lower-case words ("light rain"). */
export const weatherWords = (code: number): string => WMO[code] ?? 'unsettled';
export const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const zoneFormats = new Map<string, Intl.DateTimeFormat>();
/** The place's real wall-clock time ("2026-10-01T06:52") for a UTC instant, DST included. */
export function zonedIso(ms: number, timeZone: string): string {
  let f = zoneFormats.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    zoneFormats.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
/** Seconds east of UTC in force at an instant. */
export const offsetAt = (ms: number, timeZone: string): number =>
  Math.round((Date.parse(zonedIso(ms, timeZone) + 'Z') - Math.floor(ms / 60e3) * 60e3) / 1000);
