/* =============================================================================
 * router.tsx — hash routing, hand-rolled.
 *
 * Five static routes and no nesting, so a dependency would cost more than it
 * saves. Hash routing also means the serverless deployment needs no rewrite
 * rules: every URL is the same document.
 * ========================================================================== */

import { useCallback, useEffect, useMemo, useState } from 'react';

export const ROUTES = ['now', 'hourly', 'forecast', 'air', 'settings'] as const;
export type Route = (typeof ROUTES)[number];

const isRoute = (value: string): value is Route => (ROUTES as readonly string[]).includes(value);

function currentRoute(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  return isRoute(raw) ? raw : 'now';
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    if (next === currentRoute()) return;
    window.location.hash = `#/${next}`;
  }, []);

  return useMemo(() => ({ route, navigate }), [route, navigate]);
}

export const ROUTE_META: Record<Route, { label: string; icon: string; title: string }> = {
  now: { label: 'Now', icon: 'sun', title: 'Current conditions' },
  hourly: { label: 'Hourly', icon: 'clock', title: 'Hourly outlook' },
  forecast: { label: 'Forecast', icon: 'calendar', title: 'Five days ahead' },
  air: { label: 'Air & Sun', icon: 'leaf', title: 'Air quality and daylight' },
  settings: { label: 'Settings', icon: 'sliders', title: 'Settings' },
};
