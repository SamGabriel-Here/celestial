import { useCallback, useMemo } from 'react';
import { useData } from '../app/data';
import { RainTimeline } from '../components/RainTimeline';
import { hourColumns, type Column } from '../lib/columns';
import { capitalise, clockLabel, fmtTemp, fmtWind, weatherWords, weekday } from '../lib/units';
import { Section } from '../section/Section';

function useHours() {
  const { forecast } = useData();
  return useMemo(() => (forecast ? hourColumns(forecast, Date.now()) : []), [forecast]);
}

export function NowRail() {
  const { forecast, settings, url } = useData();
  const cols = useHours();
  const c = cols[Math.min(url.t, cols.length - 1)];
  if (!forecast || !c) return null;
  const u = settings.unit;
  const km = (m: number | null) => (m === null ? '—' : `${(m / 1000).toFixed(1)} km`);
  return (
    <>
      <RainTimeline quarters={forecast.quarters} />
      <div className="rail-more">
      <section className="layers" aria-live="polite">
        <h2>Above you at {clockLabel(c.iso)}</h2>
        <dl>
          <div><dt>High cloud <small>6–12 km</small></dt><dd className="mono">{c.high}%</dd></div>
          <div><dt>Mid cloud <small>2–6 km</small></dt><dd className="mono">{c.mid}%</dd></div>
          <div><dt>Low cloud <small>0–2 km</small></dt><dd className="mono">{c.low}%</dd></div>
          <div className="frz"><dt>Freezing level <small>snow above it</small></dt><dd className="mono">{km(c.freeze)}</dd></div>
          <div><dt>Rain <small>chance, amount</small></dt><dd className="mono">{c.pop ?? '—'}% · {c.mm.toFixed(1)} mm</dd></div>
        </dl>
      </section>
      <section className="week">
        <h2>The week</h2>
        <ol>
          {forecast.days.slice(0, 7).map((d, i) => (
            <li key={d.iso}>
              <span>{i ? weekday(d.iso) : 'Today'}</span>
              <span>{capitalise(weatherWords(d.code))}</span>
              <span className="mono">{fmtTemp(d.max, u)} <span className="lo">{fmtTemp(d.min, u)}</span></span>
            </li>
          ))}
        </ol>
      </section>
      </div>
    </>
  );
}

export function NowPanel() {
  const { settings, url, setUrl } = useData();
  const cols = useHours();
  const u = settings.unit;
  const fmt = useCallback((c: number) => fmtTemp(c, u), [u]);
  const onCursor = useCallback((t: number) => setUrl({ t }), [setUrl]);
  const describeCol = (c: Column) => `${clockLabel(c.iso)}, ${fmt(c.temp)}, ${weatherWords(c.code)}, ${c.pop ?? 'unknown'}% chance of rain`;

  return (
    <Section cols={cols} kind="hours" cursor={url.t} onCursor={onCursor} fmtTemp={fmt}
      label="The next 36 hours: use the arrow keys to move through the hours"
      valueText={describeCol}
      readout={(c) => (
        <>
          <b>{weekday(c.iso)} {clockLabel(c.iso)}</b>
          <span className="mono">{fmt(c.temp)} · {weatherWords(c.code)}</span>
          <span className="mono">rain {c.pop ?? '—'}% · {fmtWind(c.wind)}</span>
          <span className="mono">{c.sunAlt > 0 ? `sun ${Math.round(c.sunAlt)}° up` : 'sun down'}</span>
        </>
      )}
      table={(
        <table>
          <caption>Hourly forecast, next 36 hours</caption>
          <thead><tr><th>Time</th><th>Temperature</th><th>Weather</th><th>Chance of rain</th><th>Rain</th><th>Cloud low/mid/high</th></tr></thead>
          <tbody>
            {cols.map((c) => (
              <tr key={c.iso}><td>{weekday(c.iso)} {clockLabel(c.iso)}</td><td>{fmt(c.temp)}</td><td>{weatherWords(c.code)}</td>
                <td>{c.pop ?? 'unknown'}%</td><td>{c.mm.toFixed(1)} mm</td><td>{c.low}/{c.mid}/{c.high}%</td></tr>
            ))}
          </tbody>
        </table>
      )} />
  );
}
