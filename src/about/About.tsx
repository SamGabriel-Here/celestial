import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Mark } from '../components/Mark';
import { Dial, type Segment } from '../dial/Dial';
import { drawMoon, SkyWindow } from '../dial/SkyWindow';
import { moonPhase, nextPhase, phaseName, sunPosition } from '../lib/astro';
import { dayColumns, hourColumns } from '../lib/columns';
import { fetchForecast, geocode, placeId } from '../lib/openmeteo';
import { loadSettings } from '../lib/places';
import { skyColour } from '../lib/sky';
import type { Forecast, Place } from '../lib/types';
import { capitalise, clockLabel, fmtTemp, weatherWords, weekday, zonedIso, type Unit } from '../lib/units';
import { buildUrl } from '../lib/url';
import { skyTime, zoneCity } from './model';

type Why = 'last' | 'zone' | 'default';
const LONDON: Place = { id: placeId(51.5085, -0.1257), name: 'London', country: 'United Kingdom', lat: 51.5085, lon: -0.1257 };
const HOUR = 3600e3;
const STEP = 120e3; // the window's sky is recomputed every two minutes of the turn, so dusk moves smoothly

/** Whose sky: the place last opened in the app, else the city the time zone is named after, else London. */
async function choosePlace(): Promise<{ place: Place; why: Why }> {
  const last = loadSettings().last;
  if (last) return { place: last, why: 'last' };
  const city = zoneCity(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const found = city ? (await geocode(city).catch(() => []))[0] : undefined;
  return found ? { place: found, why: 'zone' } : { place: LONDON, why: 'default' };
}

const appUrl = (p: Place) => buildUrl({ q: p.name, at: { lat: p.lat, lon: p.lon }, view: 'now', t: 0 });

export function About() {
  const [state, setState] = useState<{ place?: Place; why?: Why; f?: Forecast; error?: boolean }>({});
  const [attempt, setAttempt] = useState(0);
  const unit = useMemo(() => loadSettings().unit, []);

  useEffect(() => {
    let live = true;
    choosePlace()
      .then(async ({ place, why }) => { const f = await fetchForecast(place); if (live) setState({ place, why, f }); })
      .catch(() => live && setState({ error: true }));
    return () => { live = false; };
  }, [attempt]);

  const ready = !!(state.f || state.error);

  const { place, why, f } = state;
  const open = place ? appUrl(place) : '/';
  return (
    <>
      <header className="top about-top">
        <a className="brand" href="/"><Mark /><span>Celestial</span></a>
        <nav className="tabs" aria-label="Sections">
          <a href="#day">Next 24 hours</a><a href="#days">16 days</a><a href="#how">How it works</a>
        </nav>
        <a className="open-link" href={open}>Open the sky</a>
      </header>
      <main>
        {f && place && why ? <DayAct f={f} place={place} why={why} unit={unit} open={open} /> : (
          <section className="about-wait">
            {state.error
              ? <div className="error" role="alert"><p>The forecast didn't load. Check the connection and try again.</p>
                  <button type="button" className="chip" onClick={() => { setState({}); setAttempt((n) => n + 1); }}>Try again</button></div>
              : <p className="quiet">Reading the sky…</p>}
          </section>
        )}
        {f && place && <DaysAct f={f} place={place} unit={unit} />}
        {ready && <HowAct place={place} />}
        {ready && <CloseAct place={place} open={open} />}
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

function DayAct({ f, place, why, unit, open }: { f: Forecast; place: Place; why: Why; unit: Unit; open: string }) {
  const ref = useRef<HTMLElement>(null);
  const now = useMemo(() => Date.now(), []);
  // Scroll moves through the sky's own time: dusk is slowed to fill the middle of the act.
  const time = useMemo(() => skyTime((h) => sunPosition(now + h * HOUR, place.lat, place.lon).alt), [now, place]);
  const step = useStep(ref, time);
  const cols = useMemo(() => hourColumns(f, now, 24), [f, now]);
  const segments = useMemo<Segment[]>(() => {
    const maxMm = Math.max(1, ...cols.map((x) => x.mm));
    return cols.map((x, k) => ({
      key: x.iso, top: x.label.slice(0, 2), bottom: fmtTemp(k === 0 ? f.current.temp : x.temp, unit), mark: k === 0,
      ...((x.pop ?? 0) >= 10 || x.mm > 0 ? { spoke: Math.max(0.001, x.mm / maxMm), spokeAlpha: (x.pop ?? 50) / 100 } : {}),
      band: skyColour(x.sunAlt, 0).horizon,
    }));
  }, [cols, f, unit]);
  if (!cols.length) return null;

  const ms = now + step * STEP;
  const i = Math.min(cols.length - 1, Math.max(0, Math.floor((ms - cols[0]!.startMs) / HOUR)));
  const c = cols[i]!;
  const iso = zonedIso(ms, f.timezone);
  const sun = sunPosition(ms, place.lat, place.lon);
  const cloud = Math.max(c.low, c.mid, c.high);
  const ph = moonPhase(ms);
  const mins = Math.round((ms - now) / 60e3);
  const ahead = mins < 1 ? 'now' : mins < 60 ? `in ${mins} min` : `in ${Math.round(mins / 60)} h`;
  const hint = step === 0
    ? `This is Celestial, running. It is the real sky over ${place.name} at this minute: the sun, the moon, the 45 brightest stars and three decks of cloud, from the live forecast. Scroll to turn the wheel through the next 24 hours.`
    : sun.alt > 0 ? `The sun is ${Math.round(sun.alt)}° up. Every hour on the rim is the live forecast for ${place.name}.`
    : sun.alt > -6 ? 'Twilight: the sun has just gone below the horizon.'
    : `Night. These are the stars above ${place.name} at ${clockLabel(iso)}, where they really are${cloud > 60 ? `, dimmed by ${cloud}% cloud` : ''}.`;

  return (
    <section id="day" ref={ref} className="day-act" aria-label="The next 24 hours">
      <div className="day-stage">
        <div className="reading">
          <h1>{place.name}{place.country ? <span>, {place.country}</span> : null}</h1>
          <p className="when num">{weekday(iso)} · {clockLabel(iso)} local · {ahead}</p>
          <p className="temp">{fmtTemp(i === 0 ? f.current.temp : c.temp, unit)}</p>
          <p className="cond">{capitalise(weatherWords(c.code))}</p>
          <p className="feels">{c.pop ?? 0}% chance of rain{c.mm >= 0.1 ? `, ${c.mm.toFixed(1)} mm` : ''}</p>
          <p className="guess small quiet">
            {why === 'last' ? 'The last place you opened.' : why === 'zone' ? 'Guessed from your time zone.' : 'London, until you choose a place.'}{' '}
            <a href={open}>Open it in Celestial</a>
          </p>
        </div>
        <div className="dial-col" inert>
          <Dial segments={segments} index={i} onIndex={() => {}} turnMs={420} label="The next 24 hours"
            valueText={`${clockLabel(c.iso)}, ${weatherWords(c.code)}`} glow={skyColour(sun.alt, cloud).horizon}>
            <SkyWindow ms={ms} lat={place.lat} lon={place.lon} low={c.low} mid={c.mid} high={c.high} mm={c.mm}
              label={`The sky over ${place.name} at ${clockLabel(iso)}: ${weatherWords(c.code)}, ${cloud}% cloud`} />
          </Dial>
        </div>
        <aside className="details">
          <section>
            <h2>{step === 0 ? 'What you are looking at' : 'This hour'}</h2>
            <p className="hint">{hint}</p>
            <dl className="at">
              <dt>Cloud</dt><dd>low {c.low}% · mid {c.mid}% · high {c.high}%</dd>
              <dt>Sun</dt><dd>{sun.alt > 0 ? `${Math.round(sun.alt)}° up` : 'below the horizon'}</dd>
              <dt>Moon</dt><dd>{phaseName(ph.phase)}, {Math.round(ph.lit * 100)}% lit</dd>
            </dl>
          </section>
        </aside>
      </div>
    </section>
  );
}

function DaysAct({ f, place, unit }: { f: Forecast; place: Place; unit: Unit }) {
  const cols = useMemo(() => dayColumns(f), [f]);
  const ref = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  // Vertical scroll travels the rail sideways, exactly its overflow. With reduced motion the stage scrolls natively instead.
  useProgress(ref, useCallback((p: number) => {
    const el = rail.current!;
    el.style.transform = matchMedia('(prefers-reduced-motion: reduce)').matches ? '' : `translateX(${-p * Math.max(0, el.scrollWidth - innerWidth)}px)`;
  }, []));
  return (
    <section id="days" ref={ref} className="days-act" aria-label="Sixteen days">
      <div className="days-stage">
        <div className="days-rail" ref={rail}>
          <div className="days-lead">
            <h2>Sixteen days</h2>
            <p>Noon over {place.name} on each of the next sixteen days, with the range, the rain it brings and the UV at its height.</p>
          </div>
          {cols.map((d, k) => (
            <article key={d.iso} className="day">
              <div className="day-sky">
                <SkyWindow ms={d.startMs} lat={place.lat} lon={place.lon} low={d.low} mid={d.mid} high={d.high} mm={d.mm / 24}
                  label={`Noon on ${weekday(d.iso)} ${Number(d.iso.slice(8, 10))}: ${weatherWords(d.code)}`} />
              </div>
              <h3>{k ? `${weekday(d.iso)} ${Number(d.iso.slice(8, 10))}` : 'Today'}</h3>
              <p className="num">{fmtTemp(d.temp, unit)} <span className="quiet">{fmtTemp(d.tempMin ?? d.temp, unit)}</span></p>
              <p>{capitalise(weatherWords(d.code))}</p>
              <p className="quiet num">{d.mm >= 0.1 ? `${d.mm.toFixed(1)} mm` : 'Dry'} · UV {d.uv != null ? Math.round(d.uv) : '—'}</p>
            </article>
          ))}
          <p className="days-end">In the app these sixteen days sit on one wheel. Turn it to any of them.</p>
        </div>
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

function HowAct({ place }: { place?: Place }) {
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
          <MoonFigure south={(place?.lat ?? 1) < 0} />
          <figcaption>Tonight: {phaseName(ph.phase).toLowerCase()}, {Math.round(ph.lit * 100)}% lit. Full moon on {weekday(fullIso)} {Number(fullIso.slice(8, 10))}.</figcaption>
        </figure>
        <div className="how-text">
          <h2>Where it comes from</h2>
          <p>Forecasts come from Open-Meteo, fetched straight from your browser. No account, no key, and nothing kept about you except the places you save, on this device.</p>
          <p>The sky is computed, not painted: the sun and moon from published astronomical formulas, the 45 brightest stars at their real coordinates, cloud laid in three decks from the forecast.</p>
          <p>It installs like an app and keeps the last forecast for when you are offline. Radar shows the last two hours of rain; Air &amp; sky has air quality and the coming lunar month.</p>
        </div>
      </div>
    </section>
  );
}

/** The instrument's printed degree scale: the ground the last screen stands on. */
const TICKS = Array.from({ length: 72 }, (_, k) => k * 5);

function CloseAct({ place, open }: { place?: Place; open: string }) {
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
          <h2>Where's your sky?</h2>
          <form className="close-form" action="/" method="get">
            <label className="sr" htmlFor="q">A place</label>
            <input id="q" name="q" required placeholder="Any city or town" autoComplete="off" />
            <button type="submit">Open the sky</button>
          </form>
          {place && <p>Or <a href={open}>open {place.name} as it is now</a>.</p>}
        </div>
        <footer className="foot small quiet">
          Forecasts by <a href="https://open-meteo.com/">Open-Meteo</a> · <a href="https://github.com/SamGabriel-Here/celestial">Source on GitHub</a>
        </footer>
      </div>
    </section>
  );
}
