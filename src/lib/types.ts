export type View = 'now' | 'days' | 'radar' | 'air';

export interface Place {
  id: string; // `${lat.toFixed(2)},${lon.toFixed(2)}`
  name: string;
  region?: string;
  country: string;
  lat: number;
  lon: number;
}

/** One forecast hour. `iso` is the place's local wall-clock time; `ms` the true UTC instant. */
export interface Hour {
  ms: number;
  iso: string;
  temp: number;
  pop: number | null;
  mm: number;
  code: number;
  low: number;
  mid: number;
  high: number;
  wind: number;
  gust: number;
  dir: number;
  uv: number | null;
  freeze: number | null;
}

export interface Quarter {
  ms: number;
  iso: string;
  mm: number;
}

export interface Day {
  iso: string; // local date, "2026-10-01"
  code: number;
  max: number;
  min: number;
  mm: number;
  pop: number | null;
  uv: number | null;
  rise: string | null; // local ISO
  set: string | null;
  daylight: number; // seconds
}

export interface Current {
  temp: number;
  feels: number;
  rh: number;
  code: number;
  cloud: number;
  wind: number;
  gust: number;
  dir: number;
  mm: number;
  pressure: number;
}

export interface Forecast {
  place: Place;
  offsetSec: number;
  fetchedAt: number;
  current: Current;
  hours: Hour[];
  quarters: Quarter[];
  days: Day[];
}

export interface Air {
  euAqi: number | null;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
}
