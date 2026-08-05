/* =============================================================================
 * config.js — the only file you need to touch to run Celestial.
 *
 * There are two ways to supply the OpenWeather key, and Celestial picks
 * whichever is available:
 *
 *   PROXY MODE (default, and what the deployed site uses)
 *     Requests go to /api/weather, and the serverless function in api/weather.js
 *     attaches the key from the OPENWEATHER_API_KEY environment variable. The
 *     key never reaches the browser. Nothing to set here.
 *
 *   DIRECT MODE (handy for local work off a plain static server)
 *     Put a key in `apiKey` below, or paste one into the app's setup panel. The
 *     browser then calls OpenWeather itself. A key set this way is visible to
 *     anyone who views source, so don't ship one this way on a public site.
 *
 * A key supplied for direct mode always wins, so you can override the proxy
 * locally without changing anything else.
 * ========================================================================== */

export const CONFIG = {
  /** Direct-mode key. Leave as the placeholder to use the proxy. */
  apiKey: 'YOUR_OPENWEATHER_API_KEY',

  /** Where the serverless proxy lives. Set to '' to disable proxy mode. */
  proxyPath: '/api/weather',

  /** Upstream endpoints, used in direct mode only. */
  endpoints: {
    current: 'https://api.openweathermap.org/data/2.5/weather',
    forecast: 'https://api.openweathermap.org/data/2.5/forecast',
    air: 'https://api.openweathermap.org/data/2.5/air_pollution',
    geocode: 'https://api.openweathermap.org/geo/1.0/direct',
    reverse: 'https://api.openweathermap.org/geo/1.0/reverse',
  },

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
 * Session key override. Held in memory only — never written to storage, never
 * sent anywhere but OpenWeather.
 */
let sessionKey = null;

export function setSessionKey(key) {
  sessionKey = key && key.trim() ? key.trim() : null;
}

/** The direct-mode key, if one was supplied. Null means "use the proxy". */
export function getApiKey() {
  if (sessionKey) return sessionKey;
  if (CONFIG.apiKey && CONFIG.apiKey !== KEY_PLACEHOLDER) return CONFIG.apiKey;
  return null;
}

export const hasApiKey = () => Boolean(getApiKey());

export const usesProxy = () => !getApiKey() && Boolean(CONFIG.proxyPath);

/** False only when there is neither a key nor a proxy to fall back on. */
export const canRequest = () => hasApiKey() || usesProxy();
