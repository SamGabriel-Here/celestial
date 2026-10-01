import type { ReactNode } from 'react';
import { useData } from '../app/data';
import { outlook } from '../lib/outlook';
import { capitalise, clockLabel, compass, fmtTemp, fmtWind, localIso, weatherWords, weekday } from '../lib/units';

/** The left column: the place, the temperature, and the answer — the two-second read. */
export function Reading({ children }: { children?: ReactNode }) {
  const { place, forecast, status, error, notice, settings, setUnit, toggleSave, retry } = useData();
  const u = settings.unit;
  const saved = !!place && settings.saved.some((p) => p.id === place.id);
  const f = forecast && place && forecast.place.id === place.id ? forecast : null;
  const now = f ? localIso(Date.now(), f.offsetSec) : '';
  const ans = f ? outlook(f, Date.now()) : '';
  const [head, ...rest] = ans.split(', ');

  return (
    <section className="reading" aria-live="polite">
      {notice && <p className="notice" role="status">{notice}</p>}
      {place && (
        <div className="place-row">
          <h1>{place.name}{place.country ? <span>, {place.country}</span> : null}</h1>
          <button type="button" className="chip" aria-pressed={saved} onClick={() => toggleSave(place)}>{saved ? 'Saved' : 'Save'}</button>
        </div>
      )}
      {f && <p className="when">{weekday(now)} · {clockLabel(now)} local{status === 'offline' && <b> · as of {clockLabel(f.asOf)}</b>}</p>}
      {!f && status === 'loading' && <p className="quiet">Reading the sky…</p>}
      {!f && status === 'error' && (
        <div className="error" role="alert">
          <p>{error ?? 'Forecast unavailable'}. Check the connection and try again.</p>
          <button type="button" className="chip" onClick={retry}>Try again</button>
        </div>
      )}
      {f && <p className="temp">{fmtTemp(f.current.temp, u)}</p>}
      {f && <p className="cond">{capitalise(weatherWords(f.current.code))}</p>}
      {f && <p className="feels">Feels like {fmtTemp(f.current.feels, u)} · wind {fmtWind(f.current.wind)} {compass(f.current.dir)}</p>}
      {f && <p className="answer"><b>{head}</b>{rest.length ? `, ${rest.join(', ')}` : ''}.</p>}
      {f && (
        <div className="unit" role="group" aria-label="Temperature unit">
          <button type="button" className="chip" aria-pressed={u === 'c'} onClick={() => setUnit('c')}>°C</button>
          <button type="button" className="chip" aria-pressed={u === 'f'} onClick={() => setUnit('f')}>°F</button>
        </div>
      )}
      {f && children}
    </section>
  );
}
