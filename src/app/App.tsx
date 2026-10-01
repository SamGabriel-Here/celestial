import { lazy, Suspense } from 'react';
import { RainTimeline } from '../components/RainTimeline';
import { Rail } from '../components/Rail';
import { Tabs } from '../components/Tabs';
import { DaysPanel, DaysRail } from '../views/Days';
import { NowPanel, NowRail } from '../views/Now';
import { DataProvider, useData } from './data';

// Leaflet and the radar only load when the Radar view opens.
const RadarPanel = lazy(() => import('../views/Radar').then((m) => ({ default: m.RadarPanel })));

export function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}

function RadarRail() {
  const { forecast } = useData();
  if (!forecast) return null;
  return (
    <>
      <RainTimeline quarters={forecast.quarters} />
      <p className="rail-more quiet small">Radar shows the last two hours in ten-minute frames. Deeper blue is heavier rain.</p>
    </>
  );
}

function Shell() {
  const { url, forecast } = useData();
  const v = url.view;
  return (
    <div className="app">
      <Rail>{v === 'now' ? <NowRail /> : v === 'days' ? <DaysRail /> : v === 'radar' ? <RadarRail /> : null}</Rail>
      <main className="panel" aria-label="Sky">
        <Tabs />
        <div className="panel-body">
          {forecast && (v === 'now' ? <NowPanel /> : v === 'days' ? <DaysPanel /> : null)}
          {v === 'radar' && (
            <Suspense fallback={<p className="panel-wait quiet">Loading radar…</p>}>
              <RadarPanel />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  );
}
