/* =============================================================================
 * store.tsx — all application state, and the only place that calls the API.
 * Views read from here; they never fetch.
 * ========================================================================== */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef,
  type ReactNode,
} from 'react';
import { ApiError, fetchWeatherBundle, geocodeCity, getCurrentPosition, reverseGeocode } from '../lib/api';
import { buildWeather, type Weather } from '../lib/transform';
import { canRequest, setSessionKey } from '../lib/config';
import { placeLabel, type Place, type Unit } from '../lib/format';
import { IDLE_SKY, readSky, type Sky } from '../lib/sky';

const RECENT_LIMIT = 6;
const REFRESH_MS = 10 * 60 * 1000;

export type Status = 'idle' | 'loading' | 'ready' | 'error' | 'setup';
export type SetupReason = 'missing' | 'rejected' | 'unconfigured' | 'missingProxy';
export type Scheme = 'auto' | 'light' | 'dark';

export interface Recent { id: string; label: string; place: Place }

interface State {
  status: Status;
  busy: boolean;
  weather: Weather | null;
  place: Place | null;
  error: string;
  setupReason: SetupReason;
  recents: Recent[];
  unit: Unit;
  scheme: Scheme;
}

type Action =
  | { type: 'loading' }
  | { type: 'busy'; busy: boolean }
  | { type: 'loaded'; weather: Weather; place: Place }
  | { type: 'failed'; message: string }
  | { type: 'setup'; reason: SetupReason }
  | { type: 'idle' }
  | { type: 'clearRecents' }
  | { type: 'unit'; unit: Unit }
  | { type: 'scheme'; scheme: Scheme };

const placeId = (p: Place) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;

/** Preferences persist; the recent-search list deliberately does not. */
const store = {
  read<T extends string>(key: string, fallback: T): T {
    try { return (localStorage.getItem(`celestial:${key}`) as T | null) ?? fallback; }
    catch { return fallback; }
  },
  write(key: string, value: string) {
    try { localStorage.setItem(`celestial:${key}`, value); } catch { /* blocked storage */ }
  },
};

const initial: State = {
  status: 'idle',
  busy: false,
  weather: null,
  place: null,
  error: '',
  setupReason: 'missing',
  recents: [],
  unit: store.read<Unit>('unit', 'metric') === 'imperial' ? 'imperial' : 'metric',
  scheme: (['auto', 'light', 'dark'] as const).includes(store.read<Scheme>('scheme', 'auto'))
    ? store.read<Scheme>('scheme', 'auto')
    : 'auto',
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loading':
      return { ...state, status: state.weather ? state.status : 'loading', busy: true, error: '' };
    case 'busy':
      return { ...state, busy: action.busy };
    case 'loaded': {
      const entry: Recent = {
        id: placeId(action.place),
        label: placeLabel(action.place),
        place: action.place,
      };
      return {
        ...state,
        status: 'ready',
        busy: false,
        error: '',
        weather: action.weather,
        place: action.place,
        recents: [entry, ...state.recents.filter((r) => r.id !== entry.id)].slice(0, RECENT_LIMIT),
      };
    }
    case 'failed':
      return { ...state, status: 'error', busy: false, error: action.message };
    case 'setup':
      return { ...state, status: 'setup', busy: false, setupReason: action.reason };
    case 'idle':
      return { ...state, status: 'idle', busy: false, error: '' };
    case 'clearRecents':
      return { ...state, recents: [] };
    case 'unit':
      return { ...state, unit: action.unit };
    case 'scheme':
      return { ...state, scheme: action.scheme };
    default:
      return state;
  }
}

/** Failures a key would fix all land on the setup panel, not a dead end. */
const SETUP_REASONS: Partial<Record<string, SetupReason>> = {
  'no-key': 'missing',
  auth: 'rejected',
  'proxy-unconfigured': 'unconfigured',
  'proxy-missing': 'missingProxy',
};

interface Store extends State {
  sky: Sky;
  search: (query: string) => Promise<void>;
  locate: () => Promise<void>;
  load: (place: Place, options?: { background?: boolean }) => Promise<void>;
  refresh: () => void;
  retry: () => void;
  clearRecents: () => void;
  setUnit: (unit: Unit) => void;
  setScheme: (scheme: Scheme) => void;
  useKey: (key: string) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const inFlight = useRef<AbortController | null>(null);
  const retryRef = useRef<(() => void) | null>(null);

  const fail = useCallback((error: unknown) => {
    if ((error as Error)?.name === 'AbortError') return;
    const reason = error instanceof ApiError ? SETUP_REASONS[error.code] : undefined;
    if (reason) { dispatch({ type: 'setup', reason }); return; }
    dispatch({
      type: 'failed',
      message: error instanceof ApiError
        ? error.message
        : 'Something unexpected went wrong. Please try again.',
    });
    if (!(error instanceof ApiError)) console.error(error);
  }, []);

  const load = useCallback<Store['load']>(async (place, { background = false } = {}) => {
    inFlight.current?.abort('superseded');
    const controller = new AbortController();
    inFlight.current = controller;
    retryRef.current = () => void load(place);

    dispatch({ type: 'loading' });
    try {
      const bundle = await fetchWeatherBundle(place.lat, place.lon, controller.signal);
      dispatch({ type: 'loaded', weather: buildWeather(bundle, place), place });
    } catch (error) {
      // A failed background refresh must not discard good data.
      if (background && (error as Error)?.name !== 'AbortError') {
        dispatch({ type: 'busy', busy: false });
        return;
      }
      fail(error);
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, [fail]);

  const search = useCallback<Store['search']>(async (query) => {
    const term = query.trim();
    if (!term) return;
    retryRef.current = () => void search(term);
    dispatch({ type: 'loading' });
    try {
      const [place] = await geocodeCity(term);
      if (place) await load(place);
    } catch (error) {
      fail(error);
    }
  }, [load, fail]);

  const locate = useCallback<Store['locate']>(async () => {
    retryRef.current = () => void locate();
    dispatch({ type: 'loading' });
    try {
      const { lat, lon } = await getCurrentPosition();
      const place = await reverseGeocode(lat, lon);
      await load({ ...place, lat, lon });
    } catch (error) {
      fail(error);
    }
  }, [load, fail]);

  const refresh = useCallback(() => {
    if (state.place) void load(state.place);
  }, [state.place, load]);

  const retry = useCallback(() => {
    if (retryRef.current) retryRef.current();
    else dispatch({ type: 'idle' });
  }, []);

  const setUnit = useCallback((unit: Unit) => {
    store.write('unit', unit);
    dispatch({ type: 'unit', unit });
  }, []);

  const setScheme = useCallback((scheme: Scheme) => {
    store.write('scheme', scheme);
    dispatch({ type: 'scheme', scheme });
  }, []);

  const useKey = useCallback((key: string) => {
    setSessionKey(key);
    dispatch({ type: 'idle' });
    if (retryRef.current) retryRef.current();
  }, []);

  // Nothing to ask for until there is a key or a proxy to ask.
  useEffect(() => {
    if (!canRequest()) dispatch({ type: 'setup', reason: 'missing' });
  }, []);

  // Keep the reading fresh while the tab is open and visible.
  useEffect(() => {
    if (!state.place) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && state.place) {
        void load(state.place, { background: true });
      }
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !state.weather || !state.place) return;
      if (Date.now() - state.weather.fetchedAt > REFRESH_MS) {
        void load(state.place, { background: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [state.place, state.weather, load]);

  const sky = useMemo(() => {
    const current = state.weather?.current;
    if (!current) return IDLE_SKY;
    return readSky(current.condition.code, current.observedAt, current.tz);
  }, [state.weather]);

  const value = useMemo<Store>(
    () => ({
      ...state, sky, search, locate, load, refresh, retry, setUnit, setScheme, useKey,
      clearRecents: () => dispatch({ type: 'clearRecents' }),
    }),
    [state, sky, search, locate, load, refresh, retry, setUnit, setScheme, useKey]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}
