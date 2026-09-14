/* =============================================================================
 * motion.ts — when authored motion is allowed to play.
 *
 * The rule: an entrance plays when the screen has something new to say — a
 * city seen for the first time, a view navigated to — and never when the same
 * content merely remounts (a tab revisit, a background refresh). Motion that
 * replays on every visit stops meaning anything and starts costing time.
 * ========================================================================== */

import { useEffect, useRef } from 'react';
import type { Place } from '../lib/format';

const seen = new Set<string>();

/**
 * True only for the first render of `key` in this session.
 *
 * Latched per instance, so a re-render mid-animation cannot strip the class and
 * cut the motion short; recorded in an effect, so StrictMode's double render
 * agrees with itself.
 */
export function useFirstShow(key: string | null | undefined): boolean {
  const latch = useRef<{ key: string | null | undefined; first: boolean } | null>(null);
  if (!latch.current || latch.current.key !== key) {
    latch.current = { key, first: Boolean(key) && !seen.has(key as string) };
  }
  useEffect(() => {
    if (key) seen.add(key);
  }, [key]);
  return latch.current.first;
}

/** Stable identity for a place, independent of how its name was spelled. */
export const placeKey = (place: Pick<Place, 'lat' | 'lon'>) =>
  `${place.lat.toFixed(3)},${place.lon.toFixed(3)}`;
