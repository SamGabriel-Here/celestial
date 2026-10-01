import { Rail } from '../components/Rail';
import { Tabs } from '../components/Tabs';
import { DataProvider, useData } from './data';

export function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}

function Shell() {
  const { url } = useData();
  return (
    <div className="app">
      <Rail />
      <main className="panel" aria-label="Sky">
        <Tabs />
        <div className="panel-body">{url.view}</div>
      </main>
    </div>
  );
}
