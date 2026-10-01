import { sunPosition } from './astro';
import type { Forecast } from './types';
import { clockLabel, weekday } from './units';

const HOUR = 3600e3;
export const TOP_M = 12000; // the section's ceiling, metres

/** One vertical slice of the section: an hour (Now) or a day (Days). */
export interface Column {
  startMs: number;
  iso: string;
  label: string;
  dayLabel?: string;
  sunAlt: number;
  low: number;
  mid: number;
  high: number;
  mm: number;
  pop: number | null;
  freeze: number | null;
  temp: number;
  tempMin?: number;
  uv?: number | null;
  code: number;
  wind: number;
}

export function hourColumns(f: Forecast, nowMs: number, span = 36): Column[] {
  const start = Math.max(0, f.hours.findIndex((h) => h.ms + HOUR > nowMs));
  return f.hours.slice(start, start + span).map((h) => ({
    startMs: h.ms, iso: h.iso, label: clockLabel(h.iso),
    ...(h.iso.endsWith('T00:00') ? { dayLabel: weekday(h.iso) } : {}),
    sunAlt: sunPosition(h.ms + HOUR / 2, f.place.lat, f.place.lon).alt,
    low: h.low, mid: h.mid, high: h.high, mm: h.mm, pop: h.pop, freeze: h.freeze, temp: h.temp, uv: h.uv,
    code: h.code, wind: h.wind,
  }));
}

/** Metres where rain leaves the cloud: under the lowest deck that is really there. */
export const cloudBase = (c: Pick<Column, 'low' | 'mid'>): number => (c.low > 20 ? 1400 : c.mid > 20 ? 3000 : 2000);

/** Canvas y for an altitude: 12 km at `top`, the ground at `top + height`. */
export const altitudeY = (m: number, top: number, height: number): number => top + (1 - m / TOP_M) * height;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** One column per forecast day: the day's mean cloud decks, its range, rain and noon sun. */
export function dayColumns(f: Forecast): Column[] {
  return f.days.map((d) => {
    const hrs = f.hours.filter((h) => h.iso.startsWith(d.iso));
    const freezes = hrs.flatMap((h) => (h.freeze === null ? [] : [h.freeze]));
    const [y, m, dd] = d.iso.split('-').map(Number) as [number, number, number];
    const solarNoon = Date.UTC(y, m - 1, dd, 12) - (f.place.lon / 15) * HOUR;
    return {
      startMs: solarNoon, iso: d.iso, label: weekday(d.iso),
      sunAlt: sunPosition(solarNoon, f.place.lat, f.place.lon).alt,
      low: mean(hrs.map((h) => h.low)), mid: mean(hrs.map((h) => h.mid)), high: mean(hrs.map((h) => h.high)),
      mm: d.mm, pop: d.pop, freeze: freezes.length ? mean(freezes) : null,
      temp: d.max, tempMin: d.min, uv: d.uv, code: d.code, wind: Math.max(0, ...hrs.map((h) => h.wind)),
    };
  });
}
