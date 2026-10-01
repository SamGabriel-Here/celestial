import type { Air, Day, Forecast, Hour, Place, Quarter } from './types';

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';

const CURRENT = 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,pressure_msl';
const HOURLY = 'temperature_2m,precipitation_probability,precipitation,weather_code,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,freezing_level_height';
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max,daylight_duration';
const POLLUTANTS = 'european_aqi,us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide';

type N = number | null;
type Series = Record<string, N[] | string[]>;
interface RawForecast {
  utc_offset_seconds: number;
  current: Record<string, number | null>;
  hourly: Series & { time: string[] };
  minutely_15: Series & { time: string[] };
  daily: Series & { time: string[] };
}

const url = (base: string, params: Record<string, string | number>) =>
  `${base}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;

export const forecastUrl = (p: Place) => url(FORECAST, {
  latitude: p.lat, longitude: p.lon, current: CURRENT, hourly: HOURLY,
  minutely_15: 'precipitation', forecast_minutely_15: 8, daily: DAILY, forecast_days: 16, timezone: 'auto',
});
export const airUrl = (p: Place) => url(AIR, { latitude: p.lat, longitude: p.lon, current: POLLUTANTS, timezone: 'auto' });
export const geocodeUrl = (q: string) => url(GEOCODE, { name: q, count: 5, language: 'en', format: 'json' });
export const currentForUrl = (ps: Place[]) => url(FORECAST, {
  latitude: ps.map((p) => p.lat).join(','), longitude: ps.map((p) => p.lon).join(','),
  current: 'temperature_2m,weather_code', timezone: 'auto',
});

export const placeId = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

// Readers for API arrays: `req` for always-present values, `opt` keeps a missing value as null.
const req = (s: Series, k: string, i: number) => (s[k]?.[i] as N) ?? 0;
const opt = (s: Series, k: string, i: number) => (s[k]?.[i] as N) ?? null;

export function parseForecast(json: unknown, place: Place): Forecast {
  const j = json as RawForecast;
  const off = j.utc_offset_seconds;
  const toMs = (iso: string) => Date.parse(iso + 'Z') - off * 1000;
  const H = j.hourly, Q = j.minutely_15, D = j.daily, c = j.current;
  const hours: Hour[] = H.time.map((iso, i) => ({
    ms: toMs(iso), iso, temp: req(H, 'temperature_2m', i), pop: opt(H, 'precipitation_probability', i),
    mm: req(H, 'precipitation', i), code: req(H, 'weather_code', i), low: req(H, 'cloud_cover_low', i),
    mid: req(H, 'cloud_cover_mid', i), high: req(H, 'cloud_cover_high', i), wind: req(H, 'wind_speed_10m', i),
    gust: req(H, 'wind_gusts_10m', i), dir: req(H, 'wind_direction_10m', i), uv: opt(H, 'uv_index', i),
    freeze: opt(H, 'freezing_level_height', i),
  }));
  const quarters: Quarter[] = Q.time.map((iso, i) => ({ ms: toMs(iso), iso, mm: req(Q, 'precipitation', i) }));
  const days: Day[] = D.time.map((iso, i) => ({
    iso, code: req(D, 'weather_code', i), max: req(D, 'temperature_2m_max', i), min: req(D, 'temperature_2m_min', i),
    mm: req(D, 'precipitation_sum', i), pop: opt(D, 'precipitation_probability_max', i), uv: opt(D, 'uv_index_max', i),
    rise: (D.sunrise?.[i] as string | undefined) ?? null, set: (D.sunset?.[i] as string | undefined) ?? null,
    daylight: req(D, 'daylight_duration', i),
  }));
  const n = (k: string) => c[k] ?? 0;
  return {
    place, offsetSec: off, fetchedAt: Date.now(), hours, quarters, days,
    current: { temp: n('temperature_2m'), feels: n('apparent_temperature'), rh: n('relative_humidity_2m'),
      code: n('weather_code'), cloud: n('cloud_cover'), wind: n('wind_speed_10m'), gust: n('wind_gusts_10m'),
      dir: n('wind_direction_10m'), mm: n('precipitation'), pressure: n('pressure_msl') },
  };
}

export function parseGeocode(json: unknown): Place[] {
  const r = (json as { results?: { name: string; admin1?: string; country_code: string; latitude: number; longitude: number }[] }).results ?? [];
  return r.map((p) => ({
    id: placeId(p.latitude, p.longitude), name: p.name, ...(p.admin1 ? { region: p.admin1 } : {}),
    country: p.country_code, lat: p.latitude, lon: p.longitude,
  }));
}

export function parseAir(json: unknown): Air {
  const c = (json as { current?: Record<string, number | null> }).current ?? {};
  const v = (k: string) => c[k] ?? null;
  return { euAqi: v('european_aqi'), usAqi: v('us_aqi'), pm25: v('pm2_5'), pm10: v('pm10'), o3: v('ozone'),
    no2: v('nitrogen_dioxide'), so2: v('sulphur_dioxide'), co: v('carbon_monoxide') };
}

/** Open-Meteo answers a multi-place request with an array, and a single place with an object. */
export function parseBatchCurrent(json: unknown): { temp: number; code: number }[] {
  const list = (Array.isArray(json) ? json : [json]) as { current: { temperature_2m: number; weather_code: number } }[];
  return list.map((x) => ({ temp: x.current.temperature_2m, code: x.current.weather_code }));
}

async function get(u: string, what: string, signal?: AbortSignal): Promise<unknown> {
  const r = await fetch(u, signal ? { signal } : {});
  if (!r.ok) throw new Error(`${what} unavailable`);
  return r.json();
}

export const geocode = async (q: string, signal?: AbortSignal) => parseGeocode(await get(geocodeUrl(q), 'Place search', signal));
export const fetchForecast = async (p: Place, signal?: AbortSignal) => parseForecast(await get(forecastUrl(p), 'Forecast', signal), p);
export const fetchAir = async (p: Place, signal?: AbortSignal) => parseAir(await get(airUrl(p), 'Air quality', signal));
export const fetchCurrentFor = async (ps: Place[]) => (ps.length ? parseBatchCurrent(await get(currentForUrl(ps), 'Saved places')) : []);
