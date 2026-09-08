/* =============================================================================
 * api.ts — network layer. Knows nothing about React or the DOM.
 * Returns raw OpenWeather payloads; shaping happens in transform.ts.
 * ========================================================================== */

import { CONFIG, getApiKey, usesProxy, canRequest, type Resource } from './config';
import type { Place } from './format';

export type ApiErrorCode =
  | 'no-key' | 'auth' | 'not-found' | 'rate-limit' | 'server'
  | 'network' | 'timeout' | 'upstream'
  | 'proxy-missing' | 'proxy-unconfigured'
  | 'geo-denied' | 'geo-failed' | 'geo-unsupported';

/** An error whose message is safe — and useful — to show to a person. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  constructor(message: string, code: ApiErrorCode = 'server', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ApiError';
    this.code = code;
  }
}

type Params = Record<string, string | number | undefined>;

/** In proxy mode the key is omitted entirely — the function adds it server-side. */
function buildUrl(resource: Resource, params: Params = {}): URL {
  const key = getApiKey();
  const url = key
    ? new URL(CONFIG.endpoints[resource])
    : new URL(CONFIG.proxyPath, window.location.origin);

  if (!key) url.searchParams.set('resource', resource);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(name, String(value));
  }
  if (key) url.searchParams.set('appid', key);
  return url;
}

function describeStatus(status: number, viaProxy: boolean): ApiError {
  switch (status) {
    case 401:
      return new ApiError(
        viaProxy
          ? 'The key stored on the server was rejected by OpenWeather. If it was created recently it may still be activating.'
          : 'That API key was rejected. Brand new keys can take about ten minutes to activate.',
        'auth'
      );
    case 404:
      // In proxy mode a 404 means the function itself is absent.
      return viaProxy
        ? new ApiError('No weather proxy is running at this address.', 'proxy-missing')
        : new ApiError('We could not find weather data for that place.', 'not-found');
    case 429:
      return new ApiError('Too many requests right now. Wait a moment and try again.', 'rate-limit');
    case 502:
      return new ApiError('The weather service could not be reached from the server.', 'upstream');
    case 503:
      return new ApiError('The server has no OpenWeather key configured yet.', 'proxy-unconfigured');
    default:
      return new ApiError(`The weather service returned an error (${status}).`, 'server');
  }
}

/** The single fetch entry point: timeout, caller abort, and error normalisation. */
async function request<T>(url: URL, signal?: AbortSignal): Promise<T> {
  if (!canRequest()) throw new ApiError('No API key configured.', 'no-key');
  const viaProxy = usesProxy();

  const controller = new AbortController();
  if (signal?.aborted) controller.abort(signal.reason);
  const timer = setTimeout(() => controller.abort('timeout'), CONFIG.timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw describeStatus(response.status, viaProxy);
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const err = error as Error;
    if (err.name === 'AbortError' && signal?.aborted) throw err; // caller cancelled
    if (err.name === 'AbortError') {
      throw new ApiError('The weather service took too long to respond.', 'timeout', { cause: err });
    }
    throw new ApiError('Could not reach the weather service. Check your connection.', 'network', {
      cause: err,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/* --- Raw payload shapes (only the fields we read) ------------------------ */

export interface RawCondition { id: number; main: string; description: string; icon: string }
interface RawMain {
  temp: number; feels_like: number; temp_min?: number; temp_max?: number;
  pressure: number; humidity: number;
}
interface RawWind { speed: number; deg?: number; gust?: number }

export interface RawCurrent {
  coord?: { lat: number; lon: number };
  weather: RawCondition[];
  main: RawMain;
  visibility?: number;
  wind?: RawWind;
  clouds?: { all: number };
  dt: number;
  sys?: { country?: string; sunrise?: number; sunset?: number };
  timezone: number;
  name?: string;
}

export interface RawForecastEntry {
  dt: number;
  main: RawMain;
  weather: RawCondition[];
  clouds?: { all: number };
  wind?: RawWind;
  pop?: number;
  visibility?: number;
}

export interface RawForecast {
  city: { name: string; country: string; timezone: number };
  list: RawForecastEntry[];
}

export interface RawAir {
  list: { dt: number; main: { aqi: number }; components: Record<string, number> }[];
}

interface RawGeo {
  name: string;
  local_names?: Record<string, string>;
  country?: string;
  state?: string;
  lat: number;
  lon: number;
}

const toPlace = (raw: RawGeo): Place => ({
  name: raw.local_names?.[CONFIG.lang] ?? raw.name,
  country: raw.country ?? '',
  state: raw.state ?? '',
  lat: raw.lat,
  lon: raw.lon,
});

/* --- Geocoding ----------------------------------------------------------- */

export async function geocodeCity(query: string, signal?: AbortSignal, limit = 5): Promise<Place[]> {
  const results = await request<RawGeo[]>(buildUrl('geocode', { q: query, limit }), signal);
  if (!Array.isArray(results) || results.length === 0) {
    throw new ApiError(
      `No place called “${query}” — check the spelling, or try "City, Country".`,
      'not-found'
    );
  }
  return results.map(toPlace);
}

/** Coordinates → a readable place. Falls back to the coordinates themselves. */
export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<Place> {
  try {
    const results = await request<RawGeo[]>(buildUrl('reverse', { lat, lon, limit: 1 }), signal);
    const first = results?.[0];
    if (first) return toPlace(first);
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    // Non-fatal: weather works without a pretty name.
  }
  return { name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: '', state: '', lat, lon };
}

/* --- Weather ------------------------------------------------------------- */

export interface WeatherBundle {
  current: RawCurrent;
  forecast: RawForecast;
  air: RawAir | null;
}

/**
 * Current and forecast are required; air quality is best-effort so a missing
 * AQI never blocks the page.
 */
export async function fetchWeatherBundle(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<WeatherBundle> {
  const shared = { lat, lon, units: 'metric', lang: CONFIG.lang };
  const [current, forecast, air] = await Promise.all([
    request<RawCurrent>(buildUrl('current', shared), signal),
    request<RawForecast>(buildUrl('forecast', shared), signal),
    request<RawAir>(buildUrl('air', { lat, lon }), signal).catch(() => null),
  ]);
  return { current, forecast, air };
}

/* --- Geolocation --------------------------------------------------------- */

const GEO_MESSAGES: Record<number, string> = {
  1: 'Location access was denied. Search for a city instead, or allow location in your browser settings.',
  2: 'Your location is unavailable right now. Try searching for a city.',
  3: 'Finding your location took too long. Try again or search for a city.',
};

export function getCurrentPosition(timeout = 10_000): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new ApiError('This browser does not support location detection.', 'geo-unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (error) =>
        reject(
          new ApiError(
            GEO_MESSAGES[error.code] ?? 'Could not determine your location.',
            error.code === 1 ? 'geo-denied' : 'geo-failed',
            { cause: error }
          )
        ),
      { enableHighAccuracy: false, timeout, maximumAge: 5 * 60 * 1000 }
    );
  });
}
