import { Rail } from '../components/Rail';
import { Tabs } from '../components/Tabs';
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
      <Rail>{url.view === 'now' && <NowRail />}</Rail>
      <main className="panel" aria-label="Sky">
        <Tabs />
        <div className="panel-body">{forecast && url.view === 'now' && <NowPanel />}</div>
      </main>
    </div>
  );
}
