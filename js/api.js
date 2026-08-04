/* =============================================================================
 * api.js — network layer. Nothing here knows about the DOM.
 * Every function returns raw OpenWeather payloads; shaping happens in
 * transform.js.
 * ========================================================================== */

import { CONFIG, getApiKey } from './config.js';

/** Error with a message that is safe (and useful) to show to a person. */
export class ApiError extends Error {
  constructor(message, { code = 'unknown', cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.cause = cause;
  }
}

function buildUrl(base, path, params) {
  const url = new URL(`${base}${path}`);
  const search = { ...params, appid: getApiKey() };
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function describeStatus(status) {
  switch (status) {
    case 401:
      return new ApiError(
        'That API key was rejected. Double-check it — brand new keys can take about 10 minutes to activate.',
        { code: 'auth' }
      );
    case 404:
      return new ApiError('We could not find weather data for that place.', { code: 'not-found' });
    case 429:
      return new ApiError('Too many requests for this key right now. Wait a moment and try again.', {
        code: 'rate-limit',
      });
    default:
      return new ApiError(`The weather service returned an error (${status}).`, { code: 'server' });
  }
}

/**
 * Single fetch entry point: applies the timeout, an optional external abort
 * signal, and turns every failure into an ApiError.
 */
async function request(url, { signal } = {}) {
  if (!getApiKey()) {
    throw new ApiError('No API key configured.', { code: 'no-key' });
  }

  const controller = new AbortController();
  if (signal?.aborted) controller.abort(signal.reason);
  const timer = setTimeout(() => controller.abort('timeout'), CONFIG.timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw describeStatus(response.status);
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // A caller-initiated abort is not a failure — let the caller ignore it.
    if (error.name === 'AbortError' && signal?.aborted) throw error;
    if (error.name === 'AbortError') {
      throw new ApiError('The weather service took too long to respond.', { code: 'timeout', cause: error });
    }
    throw new ApiError('Could not reach the weather service. Check your connection.', {
      code: 'network',
      cause: error,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/* --- Geocoding --------------------------------------------------------- */

/** City name -> up to `limit` candidate places. */
export async function geocodeCity(query, { limit = 5, signal } = {}) {
  const url = buildUrl(CONFIG.geoBase, '/direct', { q: query, limit });
  const results = await request(url, { signal });
  if (!Array.isArray(results) || results.length === 0) {
    throw new ApiError(`No place called “${query}” — check the spelling, or try "City, Country".`, {
      code: 'not-found',
    });
  }
  return results.map(toPlace);
}

/** Coordinates -> a human-readable place. Falls back to the raw coordinates. */
export async function reverseGeocode(lat, lon, { signal } = {}) {
  const url = buildUrl(CONFIG.geoBase, '/reverse', { lat, lon, limit: 1 });
  try {
    const results = await request(url, { signal });
    if (Array.isArray(results) && results.length) return toPlace(results[0]);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    // Non-fatal: we can still show weather without a pretty name.
  }
  return { name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: '', state: '', lat, lon };
}

function toPlace(raw) {
  return {
    name: raw.local_names?.[CONFIG.lang] || raw.name,
    country: raw.country || '',
    state: raw.state || '',
    lat: raw.lat,
    lon: raw.lon,
  };
}

/* --- Weather ----------------------------------------------------------- */

export function fetchCurrent(lat, lon, { signal } = {}) {
  return request(buildUrl(CONFIG.weatherBase, '/weather', { lat, lon, units: 'metric', lang: CONFIG.lang }), {
    signal,
  });
}

export function fetchForecast(lat, lon, { signal } = {}) {
  return request(buildUrl(CONFIG.weatherBase, '/forecast', { lat, lon, units: 'metric', lang: CONFIG.lang }), {
    signal,
  });
}

export function fetchAirQuality(lat, lon, { signal } = {}) {
  return request(buildUrl(CONFIG.weatherBase, '/air_pollution', { lat, lon }), { signal });
}

/**
 * One call for everything the dashboard needs. Current + forecast are required;
 * air quality is best-effort so a missing AQI never blocks the page.
 */
export async function fetchWeatherBundle(lat, lon, { signal } = {}) {
  const [current, forecast, air] = await Promise.all([
    fetchCurrent(lat, lon, { signal }),
    fetchForecast(lat, lon, { signal }),
    fetchAirQuality(lat, lon, { signal }).catch(() => null),
  ]);
  return { current, forecast, air };
}

/* --- Geolocation ------------------------------------------------------- */

/** Promise wrapper around the browser geolocation API with friendly errors. */
export function getCurrentPosition({ timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new ApiError('This browser does not support location detection.', { code: 'geo-unsupported' }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      (error) => {
        const messages = {
          1: 'Location access was denied. Search for a city instead, or allow location in your browser settings.',
          2: 'Your location is unavailable right now. Try searching for a city.',
          3: 'Finding your location took too long. Try again or search for a city.',
        };
        reject(
          new ApiError(messages[error.code] || 'Could not determine your location.', {
            code: error.code === 1 ? 'geo-denied' : 'geo-failed',
            cause: error,
          })
        );
      },
      { enableHighAccuracy: false, timeout, maximumAge: 5 * 60 * 1000 }
    );
  });
}
