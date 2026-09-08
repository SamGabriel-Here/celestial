/* =============================================================================
 * States.tsx — everything the app shows when it does not have weather:
 * first run, loading, an error, or a missing API key.
 * ========================================================================== */

import { useState, type FormEvent } from 'react';
import { BrandMark, Icon } from './icons';
import { useStore, type SetupReason } from '../app/store';

const SUGGESTIONS = ['London', 'Tokyo', 'New York', 'Cape Town', 'Reykjavík'];

export function EmptyState() {
  const { search, locate } = useStore();
  return (
    <section className="state">
      <BrandMark size={54} />
      <h1 className="h-display">Look up.</h1>
      <p className="state__body">
        Search any city for its live sky — conditions now, the hours ahead, five days out,
        and the air you would be breathing.
      </p>
      <div className="state__actions">
        <button type="button" className="btn btn--primary" onClick={() => void locate()}>
          <Icon name="pin" size={15} />Use my location
        </button>
      </div>
      <ul className="chips" style={{ justifyContent: 'center' }}>
        {SUGGESTIONS.map((city) => (
          <li key={city}>
            <button type="button" className="chip" onClick={() => void search(city)}>{city}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LoadingState() {
  return (
    <section className="state" aria-live="polite" aria-busy="true">
      <span className="orbit" aria-hidden="true"><i /><i /><i /></span>
      <p className="muted">Reading the sky…</p>
    </section>
  );
}

export function ErrorState() {
  const { error, retry, locate } = useStore();
  return (
    <section className="state" role="alert">
      <span className="state__art state__art--warn"><Icon name="alert" size={26} /></span>
      <h1 className="h-display" style={{ fontSize: 'clamp(1.9rem, 4vw, 2.6rem)' }}>That didn’t work</h1>
      <p className="state__body">{error}</p>
      <div className="state__actions">
        <button type="button" className="btn btn--primary" onClick={retry}>Try again</button>
        <button type="button" className="btn" onClick={() => void locate()}>Use my location</button>
      </div>
    </section>
  );
}

const SETUP_COPY: Record<SetupReason, { title: string; body: JSX.Element }> = {
  missing: {
    title: 'Add an OpenWeather key',
    body: <>Celestial needs a free OpenWeather key. Set <code>OPENWEATHER_API_KEY</code> on the server, or paste one below to use for this browser session only — it is kept in memory and never saved.</>,
  },
  rejected: {
    title: 'That key was rejected',
    body: <>OpenWeather turned this key down. If you only just created it, give it up to two hours to activate — that is far and away the usual cause. Otherwise paste a different key below.</>,
  },
  unconfigured: {
    title: 'The server has no key yet',
    body: <>Celestial is running in proxy mode, but <code>OPENWEATHER_API_KEY</code> is not set on the server. Add it in your Vercel project settings and redeploy — or paste a key below for this session.</>,
  },
  missingProxy: {
    title: 'No weather proxy here',
    body: <>This build expects a serverless function at <code>/api/weather</code>, and a plain static server has none. Paste a key below to call OpenWeather directly instead.</>,
  },
};

export function SetupState() {
  const { setupReason, useKey } = useStore();
  const [value, setValue] = useState('');
  const copy = SETUP_COPY[setupReason];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    useKey(value.trim());
    setValue('');
  };

  return (
    <section className="state">
      <span className="state__art"><BrandMark size={30} /></span>
      <h1 className="h-display" style={{ fontSize: 'clamp(1.9rem, 4vw, 2.6rem)' }}>{copy.title}</h1>
      <p className="state__body">{copy.body}</p>
      <form className="state__form" onSubmit={submit}>
        <label className="sr-only" htmlFor="key">OpenWeather API key</label>
        <input id="key" className="input input--plain" value={value} autoComplete="off" spellCheck={false}
          placeholder="Paste your API key" onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className="btn btn--primary">Use key</button>
      </form>
      <p className="faint" style={{ fontSize: '0.8rem' }}>
        Keys are free at{' '}
        <a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer">openweathermap.org/api</a>.
      </p>
    </section>
  );
}
