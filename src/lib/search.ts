import type { Place } from './types';

/** The suggestion Enter should open — only if the list belongs to what is typed now. */
export function pickOption(options: Place[], optionsTerm: string, q: string, active: number): Place | undefined {
  if (optionsTerm !== q.trim()) return undefined;
  return options[active] ?? options[0];
}

/** GeolocationPositionError codes: 1 refused, 2 unavailable, 3 timed out. */
export const locationMessage = (code: number): string =>
  code === 1
    ? 'Location is off for this site. Allow it in your browser’s site settings, or search for a place.'
    : 'Couldn’t find your location just now. Search for a place instead.';
