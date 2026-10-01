import { Rail } from '../components/Rail';
import { Tabs } from '../components/Tabs';
import { DaysPanel, DaysRail } from '../views/Days';
import { NowPanel, NowRail } from '../views/Now';
import { DataProvider, useData } from './data';

export function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}

function Shell() {
  const { url, forecast } = useData();
  return (
    <div className="app">
      <Rail>{url.view === 'now' ? <NowRail /> : url.view === 'days' ? <DaysRail /> : null}</Rail>
      <main className="panel" aria-label="Sky">
        <Tabs />
        <div className="panel-body">{forecast && (url.view === 'now' ? <NowPanel /> : url.view === 'days' ? <DaysPanel /> : null)}</div>
      </main>
    </div>
  );
}
