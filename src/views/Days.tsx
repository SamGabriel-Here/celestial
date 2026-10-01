import { useCallback, useMemo } from 'react';
import { useData } from '../app/data';
import { dayColumns, type Column } from '../lib/columns';
import { capitalise, fmtTemp, weatherWords, weekday } from '../lib/units';
import { Section } from '../section/Section';

const dateOf = (iso: string) => Number(iso.slice(8, 10));

function useDays() {
  const { forecast } = useData();
  return useMemo(() => (forecast ? dayColumns(forecast) : []), [forecast]);
}

export function DaysRail() {
  const { forecast, settings } = useData();
  const cols = useDays();
  if (!forecast || !cols.length) return null;
  const u = settings.unit;
  const warm = cols.reduce((a, b) => (b.temp > a.temp ? b : a));
  const wet = cols.reduce((a, b) => (b.mm > a.mm ? b : a));
  const day = (c: Column) => `${weekday(c.iso)} ${dateOf(c.iso)}`;
  return (
    <div className="rail-more">
      <p className="summary">
        Warmest on {day(warm)} at {fmtTemp(warm.temp, u)}.{' '}
        {wet.mm >= 1 ? <>Wettest on {day(wet)}, {wet.mm.toFixed(0)} mm.</> : <>No real rain in sixteen days.</>}
      </p>
      <section className="week">
        <h2>Sixteen days</h2>
        <ol>
          {forecast.days.map((d, i) => (
            <li key={d.iso} className="day">
              <span>{i ? `${weekday(d.iso)} ${dateOf(d.iso)}` : 'Today'}</span>
              <span>{capitalise(weatherWords(d.code))}<small>{d.mm >= 0.1 ? `${d.mm.toFixed(1)} mm` : 'dry'}{d.pop != null ? ` · ${d.pop}%` : ''}{d.uv != null ? ` · UV ${Math.round(d.uv)}` : ''}</small></span>
              <span className="mono">{fmtTemp(d.max, u)} <span className="lo">{fmtTemp(d.min, u)}</span></span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function DaysPanel() {
  const { settings, url, setUrl } = useData();
  const cols = useDays();
  const u = settings.unit;
  const fmt = useCallback((c: number) => fmtTemp(c, u), [u]);
  const onCursor = useCallback((t: number) => setUrl({ t }), [setUrl]);
  const cursor = Math.min(url.t, cols.length - 1);

  return (
    <Section cols={cols} kind="days" cursor={cursor} onCursor={onCursor} fmtTemp={fmt}
      label="The next sixteen days: use the arrow keys to move through the days"
      valueText={(c) => `${weekday(c.iso)} ${dateOf(c.iso)}: high ${fmt(c.temp)}, low ${fmt(c.tempMin ?? c.temp)}, ${weatherWords(c.code)}, ${c.mm.toFixed(1)} millimetres of rain`}
      readout={(c) => (
        <>
          <b>{weekday(c.iso)} {dateOf(c.iso)}</b>
          <span className="mono">{fmt(c.temp)} / {fmt(c.tempMin ?? c.temp)} · {weatherWords(c.code)}</span>
          <span className="mono">rain {c.mm.toFixed(1)} mm · {c.pop ?? '—'}%</span>
          <span className="mono">UV {c.uv != null ? Math.round(c.uv) : '—'} · cloud {Math.round((c.low + c.mid + c.high) / 3)}%</span>
        </>
      )}
      table={(
        <table>
          <caption>Daily forecast, next sixteen days</caption>
          <thead><tr><th>Day</th><th>High</th><th>Low</th><th>Weather</th><th>Rain</th><th>Chance of rain</th><th>UV</th></tr></thead>
          <tbody>
            {cols.map((c) => (
              <tr key={c.iso}><td>{weekday(c.iso)} {dateOf(c.iso)}</td><td>{fmt(c.temp)}</td><td>{fmt(c.tempMin ?? c.temp)}</td>
                <td>{weatherWords(c.code)}</td><td>{c.mm.toFixed(1)} mm</td><td>{c.pop ?? 'unknown'}%</td><td>{c.uv ?? 'unknown'}</td></tr>
            ))}
          </tbody>
        </table>
      )} />
  );
}
