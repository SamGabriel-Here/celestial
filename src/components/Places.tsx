import { useEffect, useState } from 'react';
import { useData } from '../app/data';
import { fetchCurrentFor } from '../lib/openmeteo';
import { capitalise, fmtTemp, weatherWords } from '../lib/units';

type Reading = { temp: number; code: number };

/** Saved places, each with its current reading — all fetched in one request. */
export function Places() {
  const { settings, place, setPlace, toggleSave } = useData();
  const saved = settings.saved;
  const [readings, setReadings] = useState<Reading[] | null>(null);
  const key = saved.map((p) => p.id).join('|');

  useEffect(() => {
    if (!saved.length) return setReadings(null);
    let live = true;
    fetchCurrentFor(saved).then((r) => live && setReadings(r)).catch(() => live && setReadings(null));
    return () => { live = false; };
    // Deps deliberately narrow: refetch only when the set of saved places changes.
  }, [key]);

  return (
    <section className="places rail-more">
      <h2>Saved places</h2>
      {!saved.length ? <p className="quiet small">Save a place to keep it here.</p> : (
        <ul>
          {saved.map((p, i) => {
            const r = readings?.[i];
            return (
              <li key={p.id} aria-current={place?.id === p.id ? 'true' : undefined}>
                <button type="button" className="go" onClick={() => setPlace(p)}>
                  <span>{p.name}<small>{[p.region, p.country].filter(Boolean).join(', ')}</small></span>
                  <span className="mono">{r ? fmtTemp(r.temp, settings.unit) : ''}<small>{r ? capitalise(weatherWords(r.code)) : ''}</small></span>
                </button>
                <button type="button" className="remove" aria-label={`Remove ${p.name}`} onClick={() => toggleSave(p)}>
                  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" /></svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
