import { useCallback, useMemo } from 'react';
import { useData } from '../app/data';
import { Dial, type Segment } from '../dial/Dial';
import { SkyWindow } from '../dial/SkyWindow';
import { moonPhase, phaseName } from '../lib/astro';
import { hourColumns } from '../lib/columns';
import { capitalise, clockLabel, fmtTemp, fmtWind, weatherWords, weekday } from '../lib/units';

const SPAN = 24;

function useHours() {
  const { forecast, now } = useData();
  return useMemo(() => (forecast ? hourColumns(forecast, now, SPAN) : []), [forecast, now]);
}

export function NowDial() {
  const { place, forecast, settings, url, setUrl } = useData();
  const cols = useHours();
  const u = settings.unit;
  const onIndex = useCallback((t: number) => setUrl({ t }), [setUrl]);
  if (!place || !cols.length) return null;
  const i = Math.min(url.t, cols.length - 1);
  const c = cols[i]!;
  const maxMm = Math.max(1, ...cols.map((x) => x.mm));
  const segments: Segment[] = cols.map((x, k) => ({
    // The current hour shows the current reading, so the rim agrees with the big number.
    key: x.iso, top: x.label.slice(0, 2), bottom: fmtTemp(k === 0 && forecast ? forecast.current.temp : x.temp, u), mark: k === 0,
    ...((x.pop ?? 0) >= 10 || x.mm > 0 ? { spoke: Math.max(0.001, x.mm / maxMm), spokeAlpha: (x.pop ?? 50) / 100 } : {}),
  }));
  const text = `${clockLabel(c.iso)}, ${fmtTemp(i === 0 && forecast ? forecast.current.temp : c.temp, u)}, ${weatherWords(c.code)}, ${c.pop ?? 'unknown'}% chance of rain`;
  return (
    <>
      <Dial segments={segments} index={i} onIndex={onIndex} label="Turn the wheel to see another hour" valueText={text}>
        <SkyWindow ms={c.startMs + 1800e3} lat={place.lat} lon={place.lon} low={c.low} mid={c.mid} high={c.high} mm={c.mm}
          label={`The sky over ${place.name} at ${clockLabel(c.iso)}: ${weatherWords(c.code)}, ${Math.max(c.low, c.mid, c.high)}% cloud`} />
      </Dial>
      <p className="dial-hint">Turn the wheel to see the sky at another hour</p>
    </>
  );
}

export function NowDetails() {
  const { place, forecast, settings, url } = useData();
  const cols = useHours();
  if (!forecast || !place || !cols.length) return null;
  const u = settings.unit;
  const c = cols[Math.min(url.t, cols.length - 1)]!;
  const ph = moonPhase(c.startMs);
  return (
    <>
      <section>
        <h2 className="moment">{weekday(c.iso)} {clockLabel(c.iso)}</h2>
        <dl className="at">
          <dt>Sky</dt><dd>{capitalise(weatherWords(c.code))}</dd>
          <dt>Temperature</dt><dd>{fmtTemp(url.t === 0 ? forecast.current.temp : c.temp, u)}</dd>
          <dt>Rain</dt><dd>{c.pop ?? '—'}% chance{c.mm >= 0.1 ? `, ${c.mm.toFixed(1)} mm` : ''}</dd>
          <dt>Cloud</dt><dd>low {c.low}% · mid {c.mid}% · high {c.high}%</dd>
          <dt>Wind</dt><dd>{fmtWind(c.wind)}</dd>
          <dt>Sun</dt><dd>{c.sunAlt > 0 ? `${Math.round(c.sunAlt)}° up` : 'below the horizon'}</dd>
          <dt>Moon</dt><dd>{phaseName(ph.phase)}, {Math.round(ph.lit * 100)}% lit</dd>
        </dl>
      </section>
      <section>
        <h2>The week</h2>
        <ol className="list">
          {forecast.days.slice(0, 7).map((d, k) => (
            <li key={d.iso}>
              <span>{k ? weekday(d.iso) : 'Today'}</span>
              <span>{capitalise(weatherWords(d.code))}</span>
              <span className="r">{fmtTemp(d.max, u)} <span>{fmtTemp(d.min, u)}</span></span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
