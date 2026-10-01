import type { ReactNode } from 'react';
import { useData } from '../app/data';
import { outlook } from '../lib/outlook';
import { capitalise, clockLabel, compass, fmtTemp, fmtWind, localIso, weatherWords, weekday } from '../lib/units';
import { Mark } from './Mark';
import { Places } from './Places';
import { Search } from './Search';

export function Rail({ children }: { children?: ReactNode }) {
  const { place, forecast, status, error, notice, settings, setUnit, toggleSave, retry } = useData();
  const u = settings.unit;
  const saved = !!place && settings.saved.some((p) => p.id === place.id);
  const f = forecast && place && forecast.place.id === place.id ? forecast : null;
  const now = f ? localIso(Date.now(), f.offsetSec) : '';

  return (
    <aside className="rail">
      <header className="brand"><Mark /><span>Celestial</span></header>
      <Search />
      {notice && <p className="notice" role="status">{notice}</p>}

      {place && (
        <section className="place" aria-live="polite">
          <div className="place-row">
            <h1>{place.name}{place.country ? <span>, {place.country}</span> : null}</h1>
            <button type="button" className="chip" aria-pressed={saved} onClick={() => toggleSave(place)}>{saved ? 'Saved' : 'Save'}</button>
          </div>
          {f && <p className="when">{weekday(now)} · {clockLabel(now)} local{status === 'offline' && <b> · as of {clockLabel(f.asOf)}</b>}</p>}
        </section>
      )}

      {!f && status === 'loading' && <p className="quiet">Reading the sky…</p>}
      {!f && status === 'error' && (
        <div className="error" role="alert">
          <p>{error ?? 'Forecast unavailable'}. Check the connection and try again.</p>
          <button type="button" className="chip" onClick={retry}>Try again</button>
        </div>
      )}

      {f && (
        <>
          <div className="now">
            <span className="t">{fmtTemp(f.current.temp, u)}</span>
            <span className="c">
              <b>{capitalise(weatherWords(f.current.code))}</b>
              <span>Feels {fmtTemp(f.current.feels, u)} · {fmtWind(f.current.wind)} {compass(f.current.dir)}</span>
            </span>
          </div>
          <p className="answer">{outlook(f, Date.now())}.</p>
          <div className="unit" role="group" aria-label="Temperature unit">
            <button type="button" aria-pressed={u === 'c'} onClick={() => setUnit('c')}>°C</button>
            <button type="button" aria-pressed={u === 'f'} onClick={() => setUnit('f')}>°F</button>
          </div>
          {children}
        </>
      )}
      <Places />
    </aside>
  );
}
