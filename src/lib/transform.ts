/* =============================================================================
 * transform.ts — raw OpenWeather payloads → the flat shapes views consume.
 * Pure functions: same input, same output, no side effects.
 * ========================================================================== */

import { CONFIG } from './config';
import { zonedDateKey, zonedHour, nowSeconds, type Place, type AqiLevel } from './format';
import type {
  RawAir, RawCondition, RawCurrent, RawForecast, RawForecastEntry, WeatherBundle,
} from './api';

export interface Condition { code: string; label: string; description: string }

const condition = (entry: { weather?: RawCondition[] } | undefined): Condition => ({
  code: entry?.weather?.[0]?.icon ?? '01d',
  label: entry?.weather?.[0]?.main ?? '',
  description: entry?.weather?.[0]?.description ?? '',
});

/* --- Current conditions -------------------------------------------------- */

export interface Current {
  place: Place;
  tz: number;
  observedAt: number;
  temp: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  visibility: number | undefined;
  clouds: number | undefined;
  wind: { speed: number | undefined; deg: number | undefined; gust: number | undefined };
  sunrise: number | undefined;
  sunset: number | undefined;
  condition: Condition;
}

export function normalizeCurrent(raw: RawCurrent, place?: Place): Current {
  return {
    place: {
      name: place?.name || raw.name || 'Unknown',
      country: place?.country || raw.sys?.country || '',
      state: place?.state ?? '',
      lat: raw.coord?.lat ?? place?.lat ?? 0,
      lon: raw.coord?.lon ?? place?.lon ?? 0,
    },
    tz: raw.timezone ?? 0,
    observedAt: raw.dt,
    temp: raw.main.temp,
    feelsLike: raw.main.feels_like,
    humidity: raw.main.humidity,
    pressure: raw.main.pressure,
    visibility: raw.visibility,
    clouds: raw.clouds?.all,
    wind: { speed: raw.wind?.speed, deg: raw.wind?.deg, gust: raw.wind?.gust },
    sunrise: raw.sys?.sunrise,
    sunset: raw.sys?.sunset,
    condition: condition(raw),
  };
}

/* --- Hourly (3-hour steps — the free tier's resolution) ------------------ */

export interface Hour {
  dt: number;
  tz: number;
  temp: number;
  feelsLike: number;
  pop: number;
  wind: number | undefined;
  humidity: number;
  condition: Condition;
}

export function buildHourly(forecast: RawForecast, limit = CONFIG.hourlySteps): Hour[] {
  const tz = forecast.city?.timezone ?? 0;
  const now = nowSeconds();
  return (forecast.list ?? [])
    .filter((entry) => entry.dt >= now - 3600)
    .slice(0, limit)
    .map((entry) => ({
      dt: entry.dt,
      tz,
      temp: entry.main.temp,
      feelsLike: entry.main.feels_like,
      pop: (entry.pop ?? 0) * 100,
      wind: entry.wind?.speed,
      humidity: entry.main.humidity,
      condition: condition(entry),
    }));
}

/* --- Daily roll-up ------------------------------------------------------- */

export interface Day {
  key: string;
  tz: number;
  dt: number;
  min: number | undefined;
  max: number | undefined;
  pop: number;
  humidity: number;
  wind: number;
  condition: Condition;
}

export function buildDaily(forecast: RawForecast, days = CONFIG.forecastDays): Day[] {
  const tz = forecast.city?.timezone ?? 0;
  const groups = new Map<string, RawForecastEntry[]>();

  for (const entry of forecast.list ?? []) {
    const key = zonedDateKey(entry.dt, tz);
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }

  const todayKey = zonedDateKey(nowSeconds(), tz);
  const summaries = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entries]) => summariseDay(key, entries, tz));

  // Prefer whole days ahead; fall back to including today when the window is short.
  const upcoming = summaries.filter((day) => day.key > todayKey);
  return (upcoming.length >= days ? upcoming : summaries).slice(0, days);
}

function summariseDay(key: string, entries: RawForecastEntry[], tz: number): Day {
  const temps = entries
    .flatMap((e) => [e.main.temp_min, e.main.temp_max, e.main.temp])
    .filter((n): n is number => Number.isFinite(n));

  // The entry nearest local midday best represents the day's character.
  const representative = entries.reduce((best, entry) =>
    Math.abs(zonedHour(entry.dt, tz) - 12) < Math.abs(zonedHour(best.dt, tz) - 12) ? entry : best
  );

  const humidities = entries.map((e) => e.main.humidity).filter(Number.isFinite);

  return {
    key,
    tz,
    dt: representative.dt,
    min: temps.length ? Math.min(...temps) : undefined,
    max: temps.length ? Math.max(...temps) : undefined,
    pop: Math.max(...entries.map((e) => (e.pop ?? 0) * 100)),
    humidity: humidities.length
      ? Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length)
      : 0,
    wind: Math.max(...entries.map((e) => e.wind?.speed ?? 0)),
    condition: condition(representative),
  };
}

/* --- Air quality --------------------------------------------------------- */

export interface Air {
  aqi: AqiLevel;
  measuredAt: number;
  components: { pm2_5?: number; pm10?: number; o3?: number; no2?: number; so2?: number; co?: number };
}

export function normalizeAir(raw: RawAir | null): Air | null {
  const entry = raw?.list?.[0];
  if (!entry) return null;
  const aqi = Math.min(5, Math.max(1, entry.main.aqi)) as AqiLevel;
  return {
    aqi,
    measuredAt: entry.dt,
    components: {
      pm2_5: entry.components.pm2_5,
      pm10: entry.components.pm10,
      o3: entry.components.o3,
      no2: entry.components.no2,
      so2: entry.components.so2,
      co: entry.components.co,
    },
  };
}

/* --- Derived values ------------------------------------------------------ */

/** 0–1 progress through daylight; null outside the sunrise→sunset window. */
export function daylightProgress(
  sunrise: number | undefined,
  sunset: number | undefined,
  at = nowSeconds()
): number | null {
  if (!sunrise || !sunset || sunset <= sunrise) return null;
  if (at <= sunrise || at >= sunset) return null;
  return (at - sunrise) / (sunset - sunrise);
}

export function todayRange(
  forecast: RawForecast,
  current: Current
): { min: number; max: number } | null {
  const tz = forecast.city?.timezone ?? 0;
  const todayKey = zonedDateKey(nowSeconds(), tz);
  const temps = (forecast.list ?? [])
    .filter((entry) => zonedDateKey(entry.dt, tz) === todayKey)
    .flatMap((entry) => [entry.main.temp_min, entry.main.temp_max])
    .filter((n): n is number => Number.isFinite(n));

  if (Number.isFinite(current.temp)) temps.push(current.temp);
  if (!temps.length) return null;
  return { min: Math.min(...temps), max: Math.max(...temps) };
}

/* --- The whole model ----------------------------------------------------- */

export interface Weather {
  current: Current;
  hourly: Hour[];
  daily: Day[];
  air: Air | null;
  range: { min: number; max: number } | null;
  fetchedAt: number;
}

export function buildWeather(bundle: WeatherBundle, place?: Place): Weather {
  const current = normalizeCurrent(bundle.current, place);
  return {
    current,
    hourly: buildHourly(bundle.forecast),
    daily: buildDaily(bundle.forecast),
    air: normalizeAir(bundle.air),
    range: todayRange(bundle.forecast, current),
    fetchedAt: Date.now(),
  };
}
