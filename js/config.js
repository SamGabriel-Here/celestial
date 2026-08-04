/* =============================================================================
 * config.js — the only file you need to touch to run Celestial.
 * Get a free key at https://openweathermap.org/api (new keys take ~10 min to
 * activate).
 * ========================================================================== */

export const CONFIG = {
  /** Paste your OpenWeather API key here. */
  apiKey: 'YOUR_OPENWEATHER_API_KEY',

  /** API roots. Kept here so a proxy can be swapped in without touching api.js. */
  weatherBase: 'https://api.openweathermap.org/data/2.5',
  geoBase: 'https://api.openweathermap.org/geo/1.0',

  /** Language for weather descriptions. */
  lang: 'en',

  /** How many 3-hour forecast steps to show in the hourly strip. */
  hourlySteps: 10,

  /** Number of days in the extended forecast. */
  forecastDays: 5,

  /** Request timeout in milliseconds. */
  timeoutMs: 12000,
};

export const KEY_PLACEHOLDER = 'YOUR_OPENWEATHER_API_KEY';

/**
 * Session key override. If config.apiKey is still the placeholder, the app lets
 * the user paste a key at runtime — held in memory only, never persisted.
 */
let sessionKey = null;

export function setSessionKey(key) {
  sessionKey = key && key.trim() ? key.trim() : null;
}

export function getApiKey() {
  if (sessionKey) return sessionKey;
  if (CONFIG.apiKey && CONFIG.apiKey !== KEY_PLACEHOLDER) return CONFIG.apiKey;
  return null;
}

export function hasApiKey() {
  return Boolean(getApiKey());
}
