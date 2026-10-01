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
