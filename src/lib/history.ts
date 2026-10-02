import { buildUrl, type AppUrl } from './url';

type Loc = Pick<Location, 'pathname' | 'search' | 'hash'>;

/**
 * Write the app's state to the address bar. Skips a replace that changes nothing, and never
 * throws: Safari rate-limits history writes and throws past ~100 in 30 s.
 */
export function writeUrl(u: AppUrl, push: boolean, h: History = history, loc: Loc = location): void {
  const href = buildUrl(u);
  if (!push && loc.pathname + loc.search + loc.hash === href) return;
  try {
    h[push ? 'pushState' : 'replaceState'](null, '', href);
  } catch {
    // The URL lags behind the view until the next write; the view itself is unaffected.
  }
}
