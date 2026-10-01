import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useData } from '../app/data';
import { moonPhase, moonPosition, phaseName, sunPosition } from '../lib/astro';
import { clockLabel, compass, localIso, weekday } from '../lib/units';
import { drawDome } from '../section/dome';

export function AirPanel() {
  const { place, forecast, url, setUrl } = useData();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const hourMs = 3600e3;
  const ms = Math.floor(Date.now() / hourMs) * hourMs + url.t * hourMs;
  const hour = forecast?.hours.find((h) => h.ms <= ms && h.ms + hourMs > ms);
  const cloud = hour ? Math.max(hour.low, hour.mid, hour.high) : forecast?.current.cloud ?? 0;

  useLayoutEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setSize(Math.max(200, Math.min(el.clientWidth, el.clientHeight) - 24)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!place || !size || !canvas.current) return;
    let live = true;
    document.fonts.ready.then(() => live && drawDome(canvas.current!, { ms, lat: place.lat, lon: place.lon, cloudPct: cloud }));
    return () => { live = false; };
  }, [place, size, ms, cloud]);

  if (!place || !forecast) return null;
  const sun = sunPosition(ms, place.lat, place.lon);
  const moon = moonPosition(ms, place.lat, place.lon);
  const ph = moonPhase(ms);
  const when = localIso(ms, forecast.offsetSec);
  const caption = `${weekday(when)} ${clockLabel(when)}: sun ${sun.alt > 0 ? `${Math.round(sun.alt)}° up in the ${compass(sun.az)}` : 'below the horizon'}; ` +
    `moon ${moon.alt > 0 ? `${Math.round(moon.alt)}° up in the ${compass(moon.az)}` : 'down'}, ${phaseName(ph.phase).toLowerCase()}, ${Math.round(ph.lit * 100)}% lit; ${cloud}% cloud.`;

  return (
    <div className="dome">
      <div ref={wrap} className="dome-stage">
        <canvas ref={canvas} style={{ width: size, height: size }} role="img" aria-label={`The sky overhead. ${caption}`} />
      </div>
      <div className="dome-controls">
        <input type="range" min={0} max={35} value={url.t} aria-label="Hour" aria-valuetext={`${weekday(when)} ${clockLabel(when)}`}
          onChange={(e) => setUrl({ t: Number(e.target.value) })} />
        <p className="mono">{caption}</p>
      </div>
    </div>
  );
}
