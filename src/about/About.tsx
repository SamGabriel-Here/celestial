import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Mark } from '../components/Mark';
import { Dial, type Segment } from '../dial/Dial';
import { drawMoon, SkyWindow } from '../dial/SkyWindow';
import { moonPhase, nextPhase, phaseName, sunPosition } from '../lib/astro';
import { dayColumns, hourColumns } from '../lib/columns';
import { fetchForecast, placeId } from '../lib/openmeteo';
import { loadSettings } from '../lib/places';
import { skyColour } from '../lib/sky';
import type { Forecast, Place } from '../lib/types';
import { capitalise, clockLabel, fmtTemp, weatherWords, weekday, zonedIso, type Unit } from '../lib/units';
import { buildUrl } from '../lib/url';
import { HOLD, skyTime, zoneCity } from './model';
import { ZONES } from './zones';

type Why = 'last' | 'zone' | 'default';
type Status = 'loading' | 'ready' | 'error';
interface Pick { place: Place; why: Why; zone?: string } // zone: the place's clock, when known before its forecast
const LONDON: Place = { id: placeId(51.51, -0.13), name: 'London', country: 'GB', lat: 51.51, lon: -0.13 };
const HOUR = 3600e3;
const STEP = 120e3; // the window's sky is recomputed every two minutes of the turn, so dusk moves smoothly

/**
 * Whose sky, decided without the network so the sky can be drawn at once: the place last opened in the
 * app, else the city the browser's time zone is named after, else London.
 */
function choosePlace(): Pick {
  const last = loadSettings().last;
  if (last) return { place: last, why: 'last' };
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone, city = zoneCity(zone), z = city ? ZONES[city] : undefined;
  if (city && z) return { place: { id: placeId(z[0], z[1]), name: city, country: z[2], lat: z[0], lon: z[1] }, why: 'zone', zone };
  return { place: LONDON, why: 'default', zone: 'Europe/London' };
}

/** Jump to the place field at the end of the tour and put the cursor in it. */
const changePlace = () => {
  document.getElementById('open')?.scrollIntoView({ block: 'end' });
  document.getElementById('q')?.focus({ preventScroll: true });
};

const appUrl = (p: Place) => buildUrl({ q: p.name, at: { lat: p.lat, lon: p.lon }, view: 'now', t: 0 });

export function About() {
  const [pick] = useState(choosePlace);
  const [f, setF] = useState<Forecast>();
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);
  const unit = useMemo(() => loadSettings().unit, []);

  // The sky is computed here and needs nothing; only the forecast on the rim waits for the network.
  useEffect(() => {
    let live = true;
    setStatus('loading');
    fetchForecast(pick.place)
      .then((x) => { if (live) { setF(x); setStatus('ready'); } })
      .catch(() => { if (live) setStatus('error'); });
    return () => { live = false; };
  }, [pick, attempt]);

  const { place } = pick;
  const open = appUrl(place);
  return (
    <>
      <header className="top about-top">
        <a className="brand" href="/"><Mark /><span>Celestial</span></a>
        <nav className="tabs" aria-label="Sections">
          <a href="#day">Next 24 hours</a>
          {/* Holds its place until there are sixteen days to jump to, so the header never reflows. */}
          <a href="#days" className={f ? undefined : 'absent'} aria-hidden={!f} tabIndex={f ? undefined : -1}>16 days</a>
          <a href="#how">How it works</a>
        </nav>
        <a className="open-link" href={open}>Open the sky</a>
      </header>
      <main>
        <DayAct f={f} pick={pick} status={status} unit={unit} retry={() => setAttempt((n) => n + 1)} />
        {f && <DaysAct f={f} place={place} unit={unit} />}
        <HowAct place={place} />
        <CloseAct place={place} open={open} />
      </main>
    </>
  );
}

/** How far through its pinned travel a tall section is (0..1), reported once a frame while the page scrolls. */
function useProgress(ref: RefObject<HTMLElement | null>, onProgress: (p: number) => void): void {
  useLayoutEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const r = ref.current!.getBoundingClientRect();
      onProgress(Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight))));
    };
    const ask = () => { if (!frame) frame = requestAnimationFrame(read); };
    addEventListener('scroll', ask, { passive: true });
    addEventListener('resize', ask);
    read();
    return () => { removeEventListener('scroll', ask); removeEventListener('resize', ask); cancelAnimationFrame(frame); };
  }, [ref, onProgress]);
}

/** The wheel's moment in whole two-minute steps, so React renders only when the moment changes. */
function useStep(ref: RefObject<HTMLElement | null>, time: (p: number) => number): number {
  const [step, setStep] = useState(0);
  useProgress(ref, useCallback((p: number) => setStep(Math.round((time(p) * HOUR) / STEP)), [time]));
  return step;
}

function DayAct({ f, pick, status, unit, retry }: { f?: Forecast; pick: Pick; status: Status; unit: Unit; retry(): void }) {
  const { place, why } = pick;
  const ref = useRef<HTMLElement>(null);
  const now = useMemo(() => Date.now(), []);
  // Scroll moves through the sky's own time: dusk is slowed to fill the middle of the act.
  const time = useMemo(() => skyTime((h) => sunPosition(now + h * HOUR, place.lat, place.lon).alt), [now, place]);
  const step = useStep(ref, time);
  // The header's mark is this wheel in miniature: its sun turns 15° for every hour the scroll moves on.
  useEffect(() => { document.documentElement.style.setProperty('--mark-turn', `${(step * STEP / HOUR) * 15}deg`); }, [step]);
  const tz = f?.timezone ?? pick.zone; // unknown for a last-opened place until its forecast says
  const cols = useMemo(() => (f ? hourColumns(f, now, 24) : []), [f, now]);
  // Before the forecast (or without it) the rim still turns: hours and the sky's own day and night, no values.
  const starts = useMemo(() => (cols.length ? cols.map((x) => x.startMs)
    : Array.from({ length: 24 }, (_, k) => Math.floor(now / HOUR) * HOUR + k * HOUR)), [cols, now]);
  const segments = useMemo<Segment[]>(() => {
    if (f && cols.length) {
      const maxMm = Math.max(1, ...cols.map((x) => x.mm));
      return cols.map((x, k) => ({
        key: x.iso, top: x.label.slice(0, 2), bottom: fmtTemp(k === 0 ? f.current.temp : x.temp, unit), mark: k === 0,
        ...((x.pop ?? 0) >= 10 || x.mm > 0 ? { spoke: Math.max(0.001, x.mm / maxMm), spokeAlpha: (x.pop ?? 50) / 100 } : {}),
        band: skyColour(x.sunAlt, 0).horizon,
      }));
    }
    return starts.map((ms, k) => ({
      key: String(ms), top: tz ? zonedIso(ms, tz).slice(11, 13) : '', bottom: '', mark: k === 0,
      band: skyColour(sunPosition(ms + HOUR / 2, place.lat, place.lon).alt, 0).horizon,
    }));
  }, [f, cols, starts, tz, unit, place]);

  const ms = now + step * STEP;
  const i = Math.min(starts.length - 1, Math.max(0, Math.floor((ms - starts[0]!) / HOUR)));
  const c = cols[i]; // the forecast hour, when there is a forecast
  const iso = tz ? zonedIso(ms, tz) : '';
  const sun = sunPosition(ms, place.lat, place.lon);
  const cloud = c ? Math.max(c.low, c.mid, c.high) : 0;
  const ph = moonPhase(ms);
  const mins = Math.round((ms - now) / 60e3);
  const ahead = mins < 1 ? 'now' : mins < 60 ? `in ${mins} min` : `in ${Math.round(mins / 60)} h`;
  const at = iso ? clockLabel(iso) : ahead;
  const hint = step === 0
    ? `This is Celestial, running. It is the real sky over ${place.name} at this minute: the sun, the moon and the 45 brightest stars, computed in your browser${f ? ', with cloud at three heights from the live forecast' : ''}.`
    : sun.alt > 0 ? `The sun is ${Math.round(sun.alt)}° up.${f ? ` Every hour on the rim is the live forecast for ${place.name}.` : ''}`
    : sun.alt > -6 ? 'Twilight: the sun has just gone below the horizon.'
    : `Night. These are the stars above ${place.name}${iso ? ` at ${at}` : ''}, where they really are${cloud > 60 ? `, dimmed by ${cloud}% cloud` : ''}.`;

  return (
    <section id="day" ref={ref} className="day-act" aria-label="The next 24 hours">
      <div className="day-stage">
        <div className="reading">
          <h1>{place.name}{place.country ? <span>, {place.country}</span> : null}</h1>
          <p className="when num">{iso ? `${weekday(iso)} · ${clockLabel(iso)} local · ${ahead}` : capitalise(ahead)}</p>
          {/* The reading keeps its shape while the forecast loads, so nothing below it jumps when it arrives. */}
          <p className={`temp${c ? '' : ' pending'}`}>{f && c ? fmtTemp(i === 0 ? f.current.temp : c.temp, unit) : '–°'}</p>
          {f && c ? (
            <>
              <p className="cond">{capitalise(weatherWords(c.code))}</p>
              <p className="feels">{c.pop ?? 0}% chance of rain{c.mm >= 0.1 ? `, ${c.mm.toFixed(1)} mm` : ''}</p>
            </>
          ) : status === 'error' ? (
            <div className="forecast-state" role="status">
              <p>The forecast didn't load, so the rim is blank. The sky is still computed for this minute.</p>
              <button type="button" className="chip" onClick={retry}>Try again</button>
            </div>
          ) : (
            <>
              <p className="cond quiet" role="status">Loading the forecast…</p>
              <p className="feels" aria-hidden="true">&nbsp;</p>
            </>
          )}
          <p className="guess small quiet">
            {why === 'last' ? 'The last place you opened' : why === 'zone' ? 'Guessed from your time zone' : 'London, until you choose a place'}
            {' · '}<a href="#open" onClick={(e) => { e.preventDefault(); changePlace(); }}>Change</a>
          </p>
        </div>
        <div className="dial-col">
          <div inert>
          <Dial segments={segments} index={i} onIndex={() => {}} turnMs={420} label="The next 24 hours"
            valueText={c ? `${at}, ${weatherWords(c.code)}` : at} glow={skyColour(sun.alt, cloud).horizon}>
            <SkyWindow ms={ms} lat={place.lat} lon={place.lon} low={c?.low ?? 0} mid={c?.mid ?? 0} high={c?.high ?? 0} mm={c?.mm ?? 0}
              label={`The sky over ${place.name} ${iso ? `at ${at}` : ahead}${c ? `: ${weatherWords(c.code)}, ${cloud}% cloud` : ''}`} />
          </Dial>
          </div>
          {/* The one instruction, under the wheel it is about; it steps back once the wheel has turned. */}
          <p className={`dial-hint${step ? ' done' : ''}`}>Scroll to turn the wheel through the next 24 hours</p>
        </div>
        <aside className="details">
          <section>
            <h2>{step === 0 ? 'What you are looking at' : 'This hour'}</h2>
            <p className="hint">{hint}</p>
            <dl className="at">
              <dt>Cloud</dt><dd>{c ? `low ${c.low}% · mid ${c.mid}% · high ${c.high}%` : '–'}</dd>
              <dt>Sun</dt><dd>{sun.alt > 0 ? `${Math.round(sun.alt)}° up` : 'below the horizon'}</dd>
              <dt>Moon</dt><dd>{phaseName(ph.phase)}, {Math.round(ph.lit * 100)}% lit</dd>
            </dl>
          </section>
        </aside>
      </div>
    </section>
  );
}

/** The app's sixteen-day wheel, turned by the scroll a day at a time: noon in the window, the fortnight beside it. */
function DaysAct({ f, place, unit }: { f: Forecast; place: Place; unit: Unit }) {
  const cols = useMemo(() => dayColumns(f), [f]);
  const ref = useRef<HTMLElement>(null);
  const [i, setI] = useState(0);
  useProgress(ref, useCallback((p: number) => {
    setI(Math.min(cols.length - 1, Math.max(0, Math.floor(((p - HOLD) / (0.92 - HOLD)) * cols.length))));
  }, [cols.length]));
  const segments = useMemo<Segment[]>(() => {
    const maxMm = Math.max(1, ...cols.map((x) => x.mm));
    return cols.map((x, k) => ({
      key: x.iso, top: k ? `${x.label} ${Number(x.iso.slice(8, 10))}` : 'Today', bottom: fmtTemp(x.temp, unit), mark: k === 0,
      ...(x.mm >= 0.1 ? { spoke: x.mm / maxMm, spokeAlpha: (x.pop ?? 50) / 100 } : {}),
    }));
  }, [cols, unit]);
  if (!cols.length) return null;
  const c = cols[i]!;
  const name = (iso: string, k: number) => (k ? `${weekday(iso)} ${Number(iso.slice(8, 10))}` : 'Today');
  const cloud = Math.max(c.low, c.mid, c.high);
  // One temperature scale for the whole fortnight, so the bars compare.
  const lo = Math.min(...cols.map((d) => d.tempMin ?? d.temp)), hi = Math.max(...cols.map((d) => d.temp));
  const at = (t: number) => `${((t - lo) / Math.max(1, hi - lo)) * 100}%`;
  return (
    <section id="days" ref={ref} className="days-act" aria-label="Sixteen days">
      <div className="day-stage">
        <div className="reading">
          <h2 className="day-name">{name(c.iso, i)}</h2>
          <p className="when num">Noon · {i ? `in ${i} ${i === 1 ? 'day' : 'days'}` : 'today'}</p>
          <p className="temp">{fmtTemp(c.temp, unit)}<span className="low"> {fmtTemp(c.tempMin ?? c.temp, unit)}</span></p>
          <p className="cond">{capitalise(weatherWords(c.code))}</p>
          <p className="feels num">{c.mm >= 0.1 ? `${c.mm.toFixed(1)} mm` : 'Dry'}{c.pop != null ? ` · ${c.pop}% rain` : ''} · UV {c.uv != null ? Math.round(c.uv) : '–'}</p>
        </div>
        <div className="dial-col">
          <div inert>
          <Dial segments={segments} index={i} onIndex={() => {}} turnMs={420} label="The next sixteen days"
            valueText={`${name(c.iso, i)}: ${weatherWords(c.code)}`} glow={skyColour(c.sunAlt, cloud).horizon}>
            <SkyWindow ms={c.startMs} lat={place.lat} lon={place.lon} low={c.low} mid={c.mid} high={c.high} mm={c.mm / 24}
              label={`Noon over ${place.name} on ${name(c.iso, i)}: ${weatherWords(c.code)}`} />
          </Dial>
          </div>
          <p className={`dial-hint${i ? ' done' : ''}`}>Scroll to turn the wheel a day at a time</p>
        </div>
        <aside className="details">
          <section>
            <h2>Sixteen days</h2>
            <p className="hint">Noon over {place.name} on each of the next sixteen days.</p>
            <ol className="ranges" aria-label="Low and high for each day, on one scale">
              {cols.map((d, k) => (
                <li key={d.iso} className={k === i ? 'sel' : undefined}>
                  <span>{name(d.iso, k)}</span>
                  <span className="track" aria-hidden="true"><i style={{ left: at(d.tempMin ?? d.temp), right: `calc(100% - ${at(d.temp)})` }} /></span>
                  <span className="num">{fmtTemp(d.tempMin ?? d.temp, unit)} {fmtTemp(d.temp, unit)}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </section>
  );
}

function MoonFigure({ south }: { south: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current!, dpr = Math.min(devicePixelRatio || 1, 2), size = el.clientWidth;
    el.width = el.height = Math.round(size * dpr);
    const g = el.getContext('2d')!;
    g.scale(dpr, dpr);
    drawMoon(g, size / 2, size / 2, size / 2 - 2, moonPhase(Date.now()).phase, south, false);
  }, [south]);
  return <canvas ref={ref} aria-hidden="true" />;
}

function HowAct({ place }: { place: Place }) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: '0px 0px -12% 0px' });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);
  const now = useMemo(() => Date.now(), []);
  const ph = moonPhase(now);
  const fullIso = zonedIso(nextPhase(now, 0.5), Intl.DateTimeFormat().resolvedOptions().timeZone);
  return (
    <section id="how" ref={ref} className={`how-act${seen ? ' in' : ''}`} aria-label="How it works">
      <div className="how-wrap">
        <figure className="moon">
          <MoonFigure south={place.lat < 0} />
          <figcaption>Tonight: {phaseName(ph.phase).toLowerCase()}, {Math.round(ph.lit * 100)}% lit. Full moon on {weekday(fullIso)} {Number(fullIso.slice(8, 10))}.</figcaption>
        </figure>
        <div className="how-text">
          <h2>How it works</h2>
          <p>Forecasts come from Open-Meteo, fetched straight from your browser. No account, no key, and nothing kept about you except the places you save, on this device.</p>
          <p>The sky is computed, not painted: the sun and moon from published astronomical formulas, the 45 brightest stars at their real coordinates, cloud laid at three heights from the forecast.</p>
          <p>It installs like an app and keeps the last forecast for when you are offline. Radar shows the last two hours of rain; Air &amp; sky has air quality and the coming lunar month.</p>
        </div>
      </div>
    </section>
  );
}

/** The instrument's printed degree scale: the ground the last screen stands on. */
const TICKS = Array.from({ length: 72 }, (_, k) => k * 5);

function CloseAct({ place, open }: { place: Place; open: string }) {
  return (
    <section id="open" className="close-act" aria-label="Open the sky">
      <div className="close-stage">
        <svg className="close-ring" viewBox="-500 -500 1000 1000" aria-hidden="true">
          <circle r="470" /><circle r="330" />
          {TICKS.map((d) => {
            const a = (d * Math.PI) / 180, r1 = d % 30 ? 486 : 478;
            return <line key={d} x1={r1 * Math.sin(a)} y1={-r1 * Math.cos(a)} x2={499 * Math.sin(a)} y2={-499 * Math.cos(a)} />;
          })}
        </svg>
        <div className="close-inner">
          <h2 className="close-q">Where's your sky?</h2>
          <form className="close-form" action="/" method="get">
            <label className="sr" htmlFor="q">A place</label>
            <input id="q" name="q" required placeholder="Any city or town" autoComplete="off" />
            <button type="submit">Open the sky</button>
          </form>
          <p>Or <a href={open}>open the sky over {place.name}</a>.</p>
        </div>
        <footer className="foot small quiet">
          Forecasts by <a href="https://open-meteo.com/">Open-Meteo</a> · <a href="https://github.com/SamGabriel-Here/celestial">Source on GitHub</a>
        </footer>
      </div>
    </section>
  );
}
