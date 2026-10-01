import { useEffect, useId, useRef, useState } from 'react';
import { useData } from '../app/data';
import { geocode } from '../lib/openmeteo';
import type { Place } from '../lib/types';

const label = (p: Place) => [p.name, p.region, p.country].filter(Boolean).join(', ');

export function Search() {
  const { setPlace, locate } = useData();
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<Place[]>([]);
  const [active, setActive] = useState(-1);
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const list = useId();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setOptions([]); return; }
    const ac = new AbortController();
    const t = setTimeout(() => {
      geocode(term, ac.signal).then((r) => { setOptions(r); setActive(-1); setMessage(''); }).catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === '/' && !typing) { e.preventDefault(); input.current?.focus(); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const choose = (p: Place) => { setPlace(p); setQ(''); setOptions([]); setMessage(''); input.current?.blur(); };

  async function submit() {
    const term = q.trim();
    if (!term) return;
    const pick = options[active] ?? options[0];
    if (pick) return choose(pick);
    const found = await geocode(term).catch(() => null);
    if (found === null) return setMessage('Place search is unavailable right now.');
    if (found[0]) return choose(found[0]);
    setMessage(`No place called “${term}”.`);
  }

  const open = options.length > 0;
  return (
    <div className="search">
      <form role="search" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label className="sr" htmlFor={`${list}-q`}>Search a place</label>
        <input id={`${list}-q`} ref={input} value={q} placeholder="Search a place" autoComplete="off" spellCheck={false}
          role="combobox" aria-expanded={open} aria-controls={list} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${list}-${active}` : undefined}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && open) { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
            if (e.key === 'ArrowUp' && open) { e.preventDefault(); setActive((a) => (a <= 0 ? options.length - 1 : a - 1)); }
            if (e.key === 'Escape') { setOptions([]); setActive(-1); }
          }} />
        <button type="submit">Go</button>
      </form>
      {open && (
        <ul id={list} role="listbox" className="options">
          {options.map((p, i) => (
            <li key={p.id} id={`${list}-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(p); }}>{label(p)}</li>
          ))}
        </ul>
      )}
      <div className="search-foot">
        <button type="button" className="link" onClick={locate}>Use my location</button>
        {message && <p className="notice" role="status">{message}</p>}
      </div>
    </div>
  );
}
