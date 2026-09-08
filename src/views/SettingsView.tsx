import { useState, type FormEvent } from 'react';
import { SectionHeading } from '../components/parts';
import { useStore, type Scheme } from '../app/store';
import type { Unit } from '../lib/format';
import { usesProxy } from '../lib/config';

const SCHEMES: { value: Scheme; label: string; hint: string }[] = [
  { value: 'auto', label: 'Follow the sky', hint: 'Light chrome by day, dark by night, wherever you are looking.' },
  { value: 'dark', label: 'Always dark', hint: 'Dark glass over every sky.' },
  { value: 'light', label: 'Always light', hint: 'Light glass — easier in a bright room.' },
];

export function SettingsView() {
  const { unit, setUnit, scheme, setScheme, recents, clearRecents, load, useKey } = useStore();
  const [key, setKey] = useState('');

  const submitKey = (event: FormEvent) => {
    event.preventDefault();
    if (!key.trim()) return;
    useKey(key.trim());
    setKey('');
  };

  return (
    <div className="page grid grid--2">
      <section className="panel">
        <SectionHeading title="Units" />
        <div className="setting">
          <p className="setting__text">
            <span className="setting__name">Temperature and speed</span>
            <span className="faint setting__hint">Data is always fetched in metric and converted here, so switching costs no request.</span>
          </p>
          <div className="seg">
            {(['metric', 'imperial'] as Unit[]).map((value) => (
              <button key={value} type="button" aria-pressed={unit === value} onClick={() => setUnit(value)}>
                {value === 'metric' ? '°C' : '°F'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <SectionHeading title="Appearance" />
        <ul className="options">
          {SCHEMES.map((option) => (
            <li key={option.value}>
              <button type="button" className="option" aria-pressed={scheme === option.value}
                onClick={() => setScheme(option.value)}>
                <span className="option__name">{option.label}</span>
                <span className="faint option__hint">{option.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <SectionHeading title="Recent searches" aside={
          recents.length ? <button type="button" className="btn" onClick={clearRecents}>Clear</button> : undefined
        } />
        {recents.length ? (
          <ul className="chips">
            {recents.map((entry) => (
              <li key={entry.id}>
                <button type="button" className="chip" onClick={() => void load(entry.place)}>{entry.label}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="faint" style={{ fontSize: '0.86rem' }}>Nothing yet. Searches are held in memory only and clear on reload — by design.</p>
        )}
      </section>

      <section className="panel">
        <SectionHeading title="API key" />
        <p className="faint" style={{ fontSize: '0.86rem', marginBottom: '0.7rem' }}>
          {usesProxy()
            ? 'Requests go through this site’s own serverless proxy, so the key stays on the server and never reaches your browser. You can override it for this session below.'
            : 'A key is set for this browser session. It lives in memory only and disappears on reload.'}
        </p>
        <form className="state__form" onSubmit={submitKey} style={{ margin: 0 }}>
          <label className="sr-only" htmlFor="settings-key">OpenWeather API key</label>
          <input id="settings-key" className="input input--plain" value={key} autoComplete="off" spellCheck={false}
            placeholder="Paste a key to override" onChange={(e) => setKey(e.target.value)} />
          <button type="submit" className="btn btn--primary">Use key</button>
        </form>
      </section>
    </div>
  );
}
