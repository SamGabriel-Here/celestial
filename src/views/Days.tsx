import { useCallback, useMemo } from 'react';
import { useData } from '../app/data';
import { Dial, type Segment } from '../dial/Dial';
import { SkyWindow } from '../dial/SkyWindow';
import { dayColumns } from '../lib/columns';
import { capitalise, fmtTemp, weatherWords, weekday } from '../lib/units';

const dateOf = (iso: string) => Number(iso.slice(8, 10));

function useDays() {
  const { forecast } = useData();
  return useMemo(() => (forecast ? dayColumns(forecast) : []), [forecast]);
}

export function DaysDial() {
  const { place, settings, url, setUrl } = useData();
  const cols = useDays();
  const u = settings.unit;
  const onIndex = useCallback((t: number) => setUrl({ t }), [setUrl]);
  if (!place || !cols.length) return null;
  const i = Math.min(url.t, cols.length - 1);
  const c = cols[i]!;
  const maxMm = Math.max(1, ...cols.map((x) => x.mm));
  const segments: Segment[] = cols.map((x, k) => ({
    key: x.iso, top: k ? `${x.label} ${dateOf(x.iso)}` : 'Today', bottom: fmtTemp(x.temp, u), mark: k === 0,
    ...(x.mm >= 0.1 ? { spoke: x.mm / maxMm, spokeAlpha: (x.pop ?? 50) / 100 } : {}),
  }));
  return (
    <>
      <Dial segments={segments} index={i} onIndex={onIndex} label="Turn the wheel to see another day"
        valueText={`${weekday(c.iso)} ${dateOf(c.iso)}: high ${fmtTemp(c.temp, u)}, low ${fmtTemp(c.tempMin ?? c.temp, u)}, ${weatherWords(c.code)}`}>
        <SkyWindow ms={c.startMs} lat={place.lat} lon={place.lon} low={c.low} mid={c.mid} high={c.high} mm={c.mm / 24}
          label={`The noon sky over ${place.name} on ${weekday(c.iso)} ${dateOf(c.iso)}: ${weatherWords(c.code)}`} />
      </Dial>
      <p className="dial-hint">Turn the wheel through sixteen days of noon skies</p>
    </>
  );
}

export function DaysDetails() {
  const { forecast, settings, url } = useData();
  const cols = useDays();
  if (!forecast || !cols.length) return null;
  const u = settings.unit;
  const i = Math.min(url.t, cols.length - 1);
  const c = cols[i]!;
  return (
    <>
      <section>
        <h2 className="moment">{i ? `${weekday(c.iso)} ${dateOf(c.iso)}` : `Today, ${weekday(c.iso)} ${dateOf(c.iso)}`}</h2>
        <dl className="at">
          <dt>Sky</dt><dd>{capitalise(weatherWords(c.code))}</dd>
          <dt>High · low</dt><dd>{fmtTemp(c.temp, u)} · {fmtTemp(c.tempMin ?? c.temp, u)}</dd>
          <dt>Rain</dt><dd>{c.mm >= 0.1 ? `${c.mm.toFixed(1)} mm` : 'dry'}{c.pop != null ? `, ${c.pop}% chance` : ''}</dd>
          <dt>UV</dt><dd>{c.uv != null ? Math.round(c.uv) : '—'}</dd>
          <dt>Cloud</dt><dd>low {Math.round(c.low)}% · mid {Math.round(c.mid)}% · high {Math.round(c.high)}%</dd>
        </dl>
      </section>
      <section>
        <h2>Sixteen days</h2>
        <ol className="list">
          {forecast.days.map((d, k) => (
            <li key={d.iso} className={k === i ? 'sel' : undefined}>
              <span>{k ? `${weekday(d.iso)} ${dateOf(d.iso)}` : 'Today'}</span>
              <span>{capitalise(weatherWords(d.code))}<small>{d.mm >= 0.1 ? `${d.mm.toFixed(1)} mm` : 'dry'}{d.pop != null ? ` · ${d.pop}%` : ''}</small></span>
              <span className="r">{fmtTemp(d.max, u)} <span>{fmtTemp(d.min, u)}</span></span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
