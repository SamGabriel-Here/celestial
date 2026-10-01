import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { HERE, placeKey, resolvePlace } from '../lib/early';
import { writeUrl } from '../lib/history';
import { fetchAir, fetchForecast, geocode, placeId } from '../lib/openmeteo';
import { loadSettings, saveSettings, toggleSaved, type Settings } from '../lib/places';
import { locationMessage } from '../lib/search';
import type { Air, Forecast, Place } from '../lib/types';
import type { Unit } from '../lib/units';
import { buildUrl, parseUrl, type AppUrl } from '../lib/url';

export const REYKJAVIK: Place = { id: placeId(64.14, -21.94), name: 'Reykjavik', region: 'Capital Region', country: 'IS', lat: 64.14, lon: -21.94 };
export { HERE };
const REFETCH_MS = 10 * 60e3; // refetch a forecast older than this
const STALE_MS = 30 * 60e3; // an observation older than this gets an "as of" stamp
const TICK_MS = 60e3; // the clock, the wheel and the answer move on with time

export type Status = 'loading' | 'ready' | 'offline' | 'error';

export interface Data {
  place: Place | null;
  forecast: Forecast | null; // only ever the forecast for `place`
  air: Air | null;
  airFailed: boolean;
  status: Status;
  stale: boolean;
  now: number;
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
const sameUrlPlace = (p: Place, u: AppUrl) => (u.at ? p.id === placeId(u.at.lat, u.at.lon) : p.name === u.q);

export function DataProvider({ children }: { children: ReactNode }) {
  const [url, setUrlState] = useState<AppUrl>(() => parseUrl(location.href));
  const urlRef = useRef(url);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [place, setPlaceState] = useState<Place | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [air, setAir] = useState<Air | null>(null);
  const [airFailed, setAirFailed] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // The address bar is written here and only here: outside React's state updaters (which may
  // run twice), skipping writes that change nothing.
  const setUrl = useCallback((patch: Partial<AppUrl>, push = false) => {
    const next = { ...urlRef.current, ...patch };
    if (!push && buildUrl(next) === buildUrl(urlRef.current)) return;
    urlRef.current = next;
    writeUrl(next, push);
    setUrlState(next);
  }, []);

  const setPlace = useCallback((p: Place, push = true) => {
    setNotice(undefined);
    setPlaceState(p);
    setUrl({ q: p.name === HERE ? undefined : p.name, at: { lat: p.lat, lon: p.lon }, t: 0 }, push);
  }, [setUrl]);

  const locateWith = useCallback((push: boolean) => {
    const fallback = () => setPlaceState((cur) => cur ?? settingsRef.current.last ?? REYKJAVIK);
    if (!('geolocation' in navigator)) {
      setNotice('This browser cannot share a location. Search for a place instead.');
      return fallback();
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPlace(hereAt(pos.coords.latitude, pos.coords.longitude), push),
      (err) => { setNotice(locationMessage(err.code)); fallback(); },
      { maximumAge: 10 * 60e3, timeout: 10e3 },
    );
  }, [setPlace]);
  const locate = useCallback(() => locateWith(true), [locateWith]);

  useEffect(() => {
    const onPop = () => { urlRef.current = parseUrl(location.href); setUrlState(urlRef.current); };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  // Resolve which place the URL (or history) means. Opening order: URL → last place →
  // granted geolocation → Reykjavik.
  useEffect(() => {
    const ac = new AbortController();
    const fallback = () => setPlaceState((cur) => cur ?? settings.last ?? REYKJAVIK);
    (async () => {
      if (url.q || url.at) {
        if (place && sameUrlPlace(place, url)) return;
        try {
          // src/early.ts may already have started this lookup; reuse it.
          const early = window.__celestialEarly;
          const p = early?.key === placeKey(url)
            ? await early.place
            : await resolvePlace(url, settings.last, (q) => geocode(q, ac.signal));
          if (ac.signal.aborted) return;
          if (p) return setPlaceState(p);
          setNotice(`No place called “${url.q}”.`);
        } catch {
          if (ac.signal.aborted) return;
          setNotice('Place search is unavailable right now.');
        }
        return fallback();
      }
      if (place) return;
      if (settings.last) return setPlaceState(settings.last);
      const granted = await navigator.permissions?.query({ name: 'geolocation' })
        .then((r) => r.state === 'granted').catch(() => false);
      if (ac.signal.aborted) return;
      if (granted) locateWith(false);
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
    // Take over the requests src/early.ts started for this place, if any; otherwise fetch.
    const early = window.__celestialEarly;
    const fromEarly = early
      ? early.place.then((p) => (p?.id === place.id ? early : undefined), () => undefined)
      : Promise.resolve(undefined);
    fromEarly.then((e) => Promise.allSettled(e ? [e.forecast, e.air] : [fetchForecast(place, ac.signal), fetchAir(place, ac.signal)])).then(([f, a]) => {
      if (ac.signal.aborted) return;
      window.__celestialEarly = undefined;
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

  // Time moves on: a minute tick, a refetch when data is old (on the tick, on focus, on
  // returning to the tab) and when the network comes back.
  useEffect(() => {
    const refresh = () => {
      setNow(Date.now());
      if (document.visibilityState === 'visible' && forecast && Date.now() - forecast.fetchedAt > REFETCH_MS) setReload((k) => k + 1);
    };
    const online = () => setReload((k) => k + 1);
    const tick = setInterval(refresh, TICK_MS);
    document.addEventListener('visibilitychange', refresh);
    addEventListener('focus', refresh);
    addEventListener('online', online);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', refresh);
      removeEventListener('focus', refresh);
      removeEventListener('online', online);
    };
  }, [forecast]);

  useEffect(() => saveSettings(settings), [settings]);

  // Never show one place's forecast under another place's name, while loading or after a failure.
  const current = forecast && place && forecast.place.id === place.id ? forecast : null;
  const value = useMemo<Data>(() => ({
    place, forecast: current, air: current ? air : null, airFailed, status, now,
    stale: !!current && now - current.asOfMs > STALE_MS,
    error, notice, settings, url, setUrl, setPlace, locate, setNotice,
    setUnit: (unit) => setSettings((s) => ({ ...s, unit })),
    toggleSave: (p) => setSettings((s) => toggleSaved(s, p)),
    retry: () => setReload((k) => k + 1),
  }), [place, current, air, airFailed, status, now, error, notice, settings, url, setUrl, setPlace, locate]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
