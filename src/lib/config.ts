/* =============================================================================
 * config.ts — how the OpenWeather key is supplied.
 *
 * PROXY MODE (default): requests go to /api/weather and the serverless function
 * attaches the key from OPENWEATHER_API_KEY. The key never reaches the browser.
 *
 * DIRECT MODE: a key in VITE_OPENWEATHER_API_KEY, or one pasted into the app,
 * makes the browser call OpenWeather itself. Useful when running without the
 * serverless function. Such a key is visible to anyone who views source.
 * ========================================================================== */

export type Resource = 'current' | 'forecast' | 'air' | 'geocode' | 'reverse';

export const CONFIG = {
  proxyPath: '/api/weather',

  endpoints: {
    current: 'https://api.openweathermap.org/data/2.5/weather',
    forecast: 'https://api.openweathermap.org/data/2.5/forecast',
    air: 'https://api.openweathermap.org/data/2.5/air_pollution',
    geocode: 'https://api.openweathermap.org/geo/1.0/direct',
    reverse: 'https://api.openweathermap.org/geo/1.0/reverse',
  } satisfies Record<Resource, string>,

  lang: 'en',
  hourlySteps: 12,
  forecastDays: 5,
  timeoutMs: 12_000,
} as const;

/** Build-time key, if the developer supplied one. */
const BUILD_KEY = (import.meta.env.VITE_OPENWEATHER_API_KEY as string | undefined)?.trim() || null;

/** Runtime key. Memory only — never persisted, never sent anywhere but OpenWeather. */
let sessionKey: string | null = null;

export function setSessionKey(key: string | null): void {
  sessionKey = key?.trim() ? key.trim() : null;
}

export const getApiKey = (): string | null => sessionKey ?? BUILD_KEY;

export const usesProxy = (): boolean => !getApiKey() && Boolean(CONFIG.proxyPath);

/** False only when there is neither a key nor a proxy to fall back on. */
export const canRequest = (): boolean => Boolean(getApiKey()) || usesProxy();
