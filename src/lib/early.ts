// Start the place search and forecast before the app bundle has finished downloading.
// `src/early.ts` runs this from its own tiny chunk; the app picks the promises up on mount.
import { fetchAir, fetchForecast, geocode, placeId } from './openmeteo';
import { loadSettings } from './places';
import type { Air, Forecast, Place } from './types';
import { parseUrl, type AppUrl } from './url';

export const HERE = 'Your location';

export interface Early {
  key: string;
  place: Promise<Place | undefined>;
  forecast: Promise<Forecast>;
  air: Promise<Air>;
}

declare global {
  interface Window { __celestialEarly?: Early }
}

/** Identifies which place a URL means, so the app can tell whether early work applies. */
export const placeKey = (u: Pick<AppUrl, 'q' | 'at'>): string => `${u.q ?? ''}|${u.at ? placeId(u.at.lat, u.at.lon) : ''}`;

/**
 * The place a URL means. Coordinates are identity (two Springfields share a name); the name
 * finds the region and country. A bare name (older links) takes the first match.
 */
export async function resolvePlace(
  u: Pick<AppUrl, 'q' | 'at'>, last: Place | undefined, find: (q: string) => Promise<Place[]> = geocode,
): Promise<Place | undefined> {
  if (u.at) {
    const id = placeId(u.at.lat, u.at.lon);
    if (last?.id === id) return last;
    if (u.q) {
      const near = (await find(u.q).catch(() => [])).find((p) => p.id === id);
      if (near) return near;
    }
    return { id, name: u.q ?? HERE, country: '', lat: u.at.lat, lon: u.at.lon };
  }
  if (u.q) return last?.name === u.q ? last : (await find(u.q))[0];
  return last;
}

const quiet = <T,>(p: Promise<T>) => { p.catch(() => {}); return p; }; // the app handles failures

export function startEarly(href: string, storage?: Storage): Early | undefined {
  const url = parseUrl(href);
  const last = loadSettings(storage).last;
  if (!url.q && !url.at && !last) return undefined;
  const place = quiet(resolvePlace(url, last));
  const need = (p: Place | undefined) => p ?? Promise.reject(new Error('No place'));
  return {
    key: placeKey(url.q || url.at ? url : { q: last!.name, at: { lat: last!.lat, lon: last!.lon } }),
    place,
    forecast: quiet(place.then(need).then((p) => fetchForecast(p))),
    air: quiet(place.then(need).then((p) => fetchAir(p))),
  };
}
