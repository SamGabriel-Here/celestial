import { lazy, Suspense } from 'react';
import { Mark } from '../components/Mark';
import { Places } from '../components/Places';
import { RainTimeline } from '../components/RainTimeline';
import { Reading } from '../components/Reading';
import { Search } from '../components/Search';
import { Tabs } from '../components/Tabs';
import { AirRail } from '../views/AirRail';
import { DaysDetails, DaysDial } from '../views/Days';
import { NowDetails, NowDial } from '../views/Now';
import { DataProvider, useData } from './data';

// Leaflet and the radar, and the moon-month dial, load only when their view opens.
const RadarDial = lazy(() => import('../views/Radar').then((m) => ({ default: m.RadarDial })));
const AirDial = lazy(() => import('../views/Air').then((m) => ({ default: m.AirDial })));

export function App() {
  return (
    <DataProvider>
      <Card />
    </DataProvider>
  );
}

function Card() {
  const { url, forecast } = useData();
  const v = url.view;
  const showRain = forecast && (v === 'now' || v === 'radar');
  return (
    <>
      <header className="top">
        <a className="brand" href="/"><Mark /><span>Celestial</span></a>
        <Tabs />
        <Search />
      </header>
      <main className="stage">
        <Reading>{showRain && <RainTimeline quarters={forecast.quarters} />}</Reading>
        <div className="dial-col">
          {forecast && (
            <Suspense fallback={<p className="dial-hint">Loading…</p>}>
              {v === 'now' ? <NowDial /> : v === 'days' ? <DaysDial /> : v === 'radar' ? <RadarDial /> : <AirDial />}
            </Suspense>
          )}
        </div>
        <aside className="details">
          {forecast && (v === 'now' ? <NowDetails /> : v === 'days' ? <DaysDetails /> : v === 'air' ? <AirRail /> : (
            <p className="quiet small">Radar shows the last two hours in ten-minute frames. Faint blue is light rain; the brighter and whiter, the heavier it falls. The ringed dot is the place.</p>
          ))}
          {forecast && <Places />}
        </aside>
      </main>
    </>
  );
}
