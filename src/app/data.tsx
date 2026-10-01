import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchAir, fetchForecast, geocode, placeId } from '../lib/openmeteo';
import { loadSettings, saveSettings, toggleSaved, type Settings } from '../lib/places';
import type { Air, Forecast, Place } from '../lib/types';
import type { Unit } from '../lib/units';
import { buildUrl, parseUrl, type AppUrl } from '../lib/url';

export const REYKJAVIK: Place = { id: placeId(64.14, -21.94), name: 'Reykjavik', region: 'Capital Region', country: 'IS', lat: 64.14, lon: -21.94 };
export const HERE = 'Your location';
const STALE_MS = 10 * 60e3;

export type Status = 'loading' | 'ready' | 'offline' | 'error';

export interface Data {
  place: Place | null;
  forecast: Forecast | null;
  air: Air | null;
  airFailed: boolean;
  status: Status;
  error: string | undefined;
  notice: string | undefined;
  settings: Settings;
  url: AppUrl;
  setUrl(patch: Partial<AppUrl>, push?: boolean): void;
  setPlace(p: Place, push?: boolean): void;
  setUnit(u: Unit): void;
  toggleSave(p: Place): void;
  locate(): void;
  retry(): void;
  setNotice(n: string | undefined): void;
}

const Ctx = createContext<Data | null>(null);

export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error('useData outside DataProvider');
  return d;
}

const hereAt = (lat: number, lon: number): Place => ({ id: placeId(lat, lon), name: HERE, country: '', lat, lon });

export function DataProvider({ children }: { children: ReactNode }) {
  const [url, setUrlState] = useState<AppUrl>(() => parseUrl(location.href));
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [place, setPlaceState] = useState<Place | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [air, setAir] = useState<Air | null>(null);
  const [airFailed, setAirFailed] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [reload, setReload] = useState(0);

  const setUrl = useCallback((patch: Partial<AppUrl>, push = false) => {
    setUrlState((cur) => {
      const next = { ...cur, ...patch };
      history[push ? 'pushState' : 'replaceState'](null, '', buildUrl(next));
      return next;
    });
  }, []);

  const setPlace = useCallback((p: Place, push = true) => {
    setNotice(undefined);
    setPlaceState(p);
    const here = p.name === HERE;
    setUrl({ q: here ? undefined : p.name, at: here ? { lat: p.lat, lon: p.lon } : undefined, t: 0 }, push);
  }, [setUrl]);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) return setNotice('This browser cannot share a location. Search for a place instead.');
    navigator.geolocation.getCurrentPosition(
      (pos) => setPlace(hereAt(pos.coords.latitude, pos.coords.longitude)),
      () => setNotice('Location is off for this site. Allow it in your browser’s site settings, or search for a place.'),
      { maximumAge: 10 * 60e3, timeout: 10e3 },
    );
  }, [setPlace]);

  useEffect(() => {
    const onPop = () => setUrlState(parseUrl(location.href));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  // Resolve which place the URL (or history) means. Opening order: URL → last place →
  // granted geolocation → Reykjavik.
  useEffect(() => {
    const ac = new AbortController();
    const fallback = () => setPlaceState((cur) => cur ?? settings.last ?? REYKJAVIK);
    (async () => {
      if (url.q) {
        if (place?.name === url.q) return;
        try {
          const [p] = await geocode(url.q, ac.signal);
          if (ac.signal.aborted) return;
          if (p) return setPlaceState(p);
          setNotice(`No place called “${url.q}”.`);
        } catch {
          if (ac.signal.aborted) return;
          setNotice('Place search is unavailable right now.');
        }
        return fallback();
      }
      if (url.at) {
        if (place?.id !== placeId(url.at.lat, url.at.lon)) setPlaceState(hereAt(url.at.lat, url.at.lon));
        return;
      }
      if (place) return;
      if (settings.last) return setPlaceState(settings.last);
      const granted = await navigator.permissions?.query({ name: 'geolocation' })
        .then((r) => r.state === 'granted').catch(() => false);
      if (ac.signal.aborted) return;
      if (granted) locate();
      else setPlaceState(REYKJAVIK);
    })();
    return () => ac.abort();
    // Deps deliberately narrow: resolves only when the URL's place changes
  }, [url.q, url.at?.lat, url.at?.lon]);

  // Forecast and air quality, in parallel; air failing never blocks the forecast.
  useEffect(() => {
    if (!place) return;
    const ac = new AbortController();
    setStatus((s) => (forecast?.place.id === place.id ? s : 'loading'));
    Promise.allSettled([fetchForecast(place, ac.signal), fetchAir(place, ac.signal)]).then(([f, a]) => {
      if (ac.signal.aborted) return;
      if (f.status === 'fulfilled') {
        setForecast(f.value);
        setStatus(navigator.onLine ? 'ready' : 'offline');
        setError(undefined);
      } else {
        setStatus(forecast?.place.id === place.id ? 'offline' : 'error');
        setError((f.reason as Error)?.message ?? 'Forecast unavailable');
      }
      setAir(a.status === 'fulfilled' ? a.value : null);
      setAirFailed(a.status === 'rejected');
    });
    setSettings((s) => ({ ...s, last: place }));
    return () => ac.abort();
    // Deps deliberately narrow: refetch per place or explicit reload only
  }, [place?.id, reload]);

  // Refresh when the tab comes back after a while, or the network returns.
  useEffect(() => {
    const stale = () => {
      if (document.visibilityState === 'visible' && forecast && Date.now() - forecast.fetchedAt > STALE_MS) setReload((k) => k + 1);
    };
    const online = () => setReload((k) => k + 1);
    document.addEventListener('visibilitychange', stale);
    addEventListener('online', online);
    return () => { document.removeEventListener('visibilitychange', stale); removeEventListener('online', online); };
  }, [forecast]);

  useEffect(() => saveSettings(settings), [settings]);

  const value = useMemo<Data>(() => ({
    place, forecast, air, airFailed, status, error, notice, settings, url, setUrl, setPlace, locate, setNotice,
    setUnit: (unit) => setSettings((s) => ({ ...s, unit })),
    toggleSave: (p) => setSettings((s) => toggleSaved(s, p)),
    retry: () => setReload((k) => k + 1),
  }), [place, forecast, air, airFailed, status, error, notice, settings, url, setUrl, setPlace, locate]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
