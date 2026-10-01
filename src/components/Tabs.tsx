import { useData } from '../app/data';
import type { View } from '../lib/types';
import { buildUrl } from '../lib/url';

const VIEWS: [View, string][] = [['now', 'Next 24 hours'], ['days', '16 days'], ['radar', 'Radar'], ['air', 'Air & sky']];

export function Tabs() {
  const { url, setUrl } = useData();
  return (
    <nav className="tabs" aria-label="Views">
      {VIEWS.map(([v, label]) => (
        <a key={v} href={buildUrl({ ...url, view: v })} aria-current={url.view === v ? 'page' : undefined}
          onClick={(e) => { e.preventDefault(); setUrl({ view: v }, true); }}>{label}</a>
      ))}
    </nav>
  );
}
