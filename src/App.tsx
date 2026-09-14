/* =============================================================================
 * App.tsx — the shell: sky, top bar, routed view, tab bar.
 * ========================================================================== */

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { SkyCanvas } from './components/SkyCanvas';
import { BrandMark, Icon } from './components/icons';
import { EmptyState, ErrorState, LoadingState, SetupState } from './components/States';
import { NowView } from './views/NowView';
import { HourlyView } from './views/HourlyView';
import { ForecastView } from './views/ForecastView';
import { AirView } from './views/AirView';
import { SettingsView } from './views/SettingsView';
import { ROUTES, ROUTE_META, useRoute, type Route } from './app/router';
import { useStore } from './app/store';
import { useFirstShow } from './app/motion';
import { Lens } from './components/Lens';
import type { Unit } from './lib/format';

const VIEWS: Record<Route, () => JSX.Element | null> = {
  now: NowView,
  hourly: HourlyView,
  forecast: ForecastView,
  air: AirView,
  settings: SettingsView,
};

const TAB_OPTIONS = ROUTES.map((name) => ({
  value: name,
  title: ROUTE_META[name].title,
  label: (
    <>
      <Icon name={ROUTE_META[name].icon as never} size={16} />
      <span>{ROUTE_META[name].label}</span>
    </>
  ),
}));

const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'metric', label: '°C' },
  { value: 'imperial', label: '°F' },
];

/** Plays the directional entrance once per navigation, never on a plain remount. */
function ViewFrame({ navId, direction, children }: { navId: number; direction: number; children: JSX.Element }) {
  const entering = useFirstShow(`view:${navId}`);
  return (
    <div className={entering ? 'view view--enter' : 'view'} style={{ '--dir': direction } as CSSProperties}>
      {children}
    </div>
  );
}

export default function App() {
  const { status, busy, weather, sky, scheme, search, locate, refresh, unit, setUnit } = useStore();
  const { route, navigate } = useRoute();
  const [query, setQuery] = useState('');

  // The chrome either follows the sky or is pinned by the user's preference.
  const chrome = scheme === 'auto' ? sky.scheme : scheme;
  useEffect(() => {
    document.documentElement.dataset.chrome = chrome;
  }, [chrome]);

  // Settings must stay reachable before any city has been chosen.
  const hasWeather = status === 'ready' && weather !== null;
  const showChrome = hasWeather || route === 'settings';

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    void search(query);
    navigate('now');
  };

  const View = VIEWS[route];

  // Latched during render (idempotent under StrictMode's double render): the
  // direction belongs to the navigation that produced this render, and a
  // remount for any other reason keeps the same id and so plays nothing.
  const nav = useRef({ route, id: 0, direction: 0 });
  if (nav.current.route !== route) {
    nav.current = {
      route,
      id: nav.current.id + 1,
      direction: Math.sign(ROUTES.indexOf(route) - ROUTES.indexOf(nav.current.route)),
    };
  }

  return (
    <>
      <SkyCanvas sky={sky} />

      {busy && weather ? <div className="progress" aria-hidden="true"><i /></div> : null}

      <div className="shell">
        <header className="topbar">
          <p className="brand">
            <BrandMark size={26} />
            Celestial <em>weather</em>
          </p>

          <form role="search" className="field" onSubmit={onSubmit}>
            <Icon name="search" size={16} />
            <label className="sr-only" htmlFor="city">Search weather by city name</label>
            <input id="city" className="input" type="search" value={query} placeholder="Search a city…"
              autoComplete="off" spellCheck={false} enterKeyHint="search"
              onChange={(event) => setQuery(event.target.value)} />
          </form>

          <div className="topbar__tools">
            <div className="seg" role="group" aria-label="Units">
              <Lens<Unit> options={UNIT_OPTIONS} value={unit} onChange={setUnit}
                announce="pressed" itemClassName="seg__item" />
            </div>
            <button type="button" className="btn btn--icon" onClick={() => void locate()} title="Use my location">
              <Icon name="pin" size={16} /><span className="sr-only">Use my location</span>
            </button>
            {hasWeather ? (
              <button type="button" className="btn btn--icon" onClick={refresh} title="Refresh">
                <Icon name="refresh" size={15} className={busy ? 'spin' : undefined} />
                <span className="sr-only">Refresh weather</span>
              </button>
            ) : null}
          </div>
        </header>

        <main className="scroll" id="main">
          {status === 'setup' && route !== 'settings' ? <SetupState /> : null}
          {status === 'error' && route !== 'settings' ? <ErrorState /> : null}
          {status === 'loading' ? <LoadingState /> : null}
          {status === 'idle' && route !== 'settings' ? <EmptyState /> : null}
          {showChrome && status !== 'loading' ? (
            <ViewFrame navId={nav.current.id} direction={nav.current.direction}>
              <View />
            </ViewFrame>
          ) : null}
        </main>

        {showChrome ? (
          <nav className="tabbar" aria-label="Views">
            <Lens<Route> options={TAB_OPTIONS} value={route} onChange={navigate}
              announce="current" itemClassName="tab" />
          </nav>
        ) : null}
      </div>
    </>
  );
}
