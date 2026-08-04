/* =============================================================================
 * transform.js — turns raw OpenWeather payloads into the small, flat shapes the
 * renderers consume. Pure functions: same input, same output, no side effects.
 * ========================================================================== */

import { CONFIG } from './config.js';
import { zonedDateKey, nowSeconds } from './format.js';

/** Shared shape for one weather condition. */
const condition = (entry) => ({
  code: entry?.weather?.[0]?.icon ?? '01d',
  label: entry?.weather?.[0]?.main ?? '',
  description: entry?.weather?.[0]?.description ?? '',
});

/* --- Current conditions -------------------------------------------------- */

export function normalizeCurrent(raw, place) {
  const tz = raw.timezone ?? 0;
  return {
    place: {
      name: place?.name || raw.name || 'Unknown',
      country: place?.country || raw.sys?.country || '',
      state: place?.state || '',
      lat: raw.coord?.lat,
      lon: raw.coord?.lon,
    },
    tz,
    observedAt: raw.dt,
    temp: raw.main?.temp,
    feelsLike: raw.main?.feels_like,
    humidity: raw.main?.humidity,
    pressure: raw.main?.pressure,
    visibility: raw.visibility,
    clouds: raw.clouds?.all,
    wind: {
      speed: raw.wind?.speed,
      deg: raw.wind?.deg,
      gust: raw.wind?.gust,
    },
    sunrise: raw.sys?.sunrise,
    sunset: raw.sys?.sunset,
    condition: condition(raw),
  };
}

/* --- Hourly (3-hour steps, the free tier's resolution) ------------------- */

export function buildHourly(forecast, { limit = CONFIG.hourlySteps } = {}) {
  const tz = forecast.city?.timezone ?? 0;
  const now = nowSeconds();

  return (forecast.list || [])
    .filter((entry) => entry.dt >= now - 3600)
    .slice(0, limit)
    .map((entry) => ({
      dt: entry.dt,
      tz,
      temp: entry.main?.temp,
      feelsLike: entry.main?.feels_like,
      pop: (entry.pop ?? 0) * 100,
      wind: entry.wind?.speed,
      condition: condition(entry),
    }));
}

/* --- Daily roll-up ------------------------------------------------------- */

export function buildDaily(forecast, { days = CONFIG.forecastDays } = {}) {
  const tz = forecast.city?.timezone ?? 0;
  const groups = new Map();

  for (const entry of forecast.list || []) {
    const key = zonedDateKey(entry.dt, tz);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  const todayKey = zonedDateKey(nowSeconds(), tz);
  const summaries = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entries]) => summariseDay(key, entries, tz));

  // Prefer whole days ahead; fall back to including today when the window is short.
  const upcoming = summaries.filter((day) => day.key > todayKey);
  const chosen = upcoming.length >= days ? upcoming : summaries;
  return chosen.slice(0, days);
}

function summariseDay(key, entries, tz) {
  const temps = entries.flatMap((e) => [e.main?.temp_min, e.main?.temp_max]).filter(Number.isFinite);

  // The entry nearest local midday best represents the day's character.
  const representative = entries.reduce((best, entry) => {
    const hour = new Date((entry.dt + tz) * 1000).getUTCHours();
    const bestHour = new Date((best.dt + tz) * 1000).getUTCHours();
    return Math.abs(hour - 12) < Math.abs(bestHour - 12) ? entry : best;
  }, entries[0]);

  return {
    key,
    tz,
    dt: representative.dt,
    min: temps.length ? Math.min(...temps) : undefined,
    max: temps.length ? Math.max(...temps) : undefined,
    pop: Math.max(...entries.map((e) => (e.pop ?? 0) * 100)),
    humidity: Math.round(average(entries.map((e) => e.main?.humidity))),
    wind: Math.max(...entries.map((e) => e.wind?.speed ?? 0)),
    condition: condition(representative),
  };
}

const average = (values) => {
  const nums = values.filter(Number.isFinite);
  return nums.length ? nums.reduce((sum, n) => sum + n, 0) / nums.length : NaN;
};

/* --- Air quality --------------------------------------------------------- */

export function normalizeAir(raw) {
  const entry = raw?.list?.[0];
  if (!entry) return null;
  return {
    aqi: entry.main?.aqi,
    measuredAt: entry.dt,
    components: {
      pm2_5: entry.components?.pm2_5,
      pm10: entry.components?.pm10,
      o3: entry.components?.o3,
      no2: entry.components?.no2,
    },
  };
}

/* --- Derived values ------------------------------------------------------ */

/** 0–1 progress through daylight; null outside the sunrise→sunset window. */
export function daylightProgress({ sunrise, sunset, at = nowSeconds() }) {
  if (!sunrise || !sunset || sunset <= sunrise) return null;
  if (at <= sunrise || at >= sunset) return null;
  return (at - sunrise) / (sunset - sunrise);
}

/** Today's high/low from the forecast, so the hero can show a range. */
export function todayRange(forecast, current) {
  const tz = forecast.city?.timezone ?? 0;
  const todayKey = zonedDateKey(nowSeconds(), tz);
  const temps = (forecast.list || [])
    .filter((entry) => zonedDateKey(entry.dt, tz) === todayKey)
    .flatMap((entry) => [entry.main?.temp_min, entry.main?.temp_max])
    .filter(Number.isFinite);

  if (Number.isFinite(current?.temp)) temps.push(current.temp);
  if (!temps.length) return null;
  return { min: Math.min(...temps), max: Math.max(...temps) };
}

/** Everything the UI needs, assembled from one bundle. */
export function buildDashboardModel({ current, forecast, air }, place) {
  const now = normalizeCurrent(current, place);
  return {
    current: now,
    hourly: buildHourly(forecast),
    daily: buildDaily(forecast),
    air: air ? normalizeAir(air) : null,
    range: todayRange(forecast, now),
    fetchedAt: Date.now(),
  };
}
