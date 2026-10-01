// The window of the planisphere: the sky over the place at one moment, in azimuthal projection —
// zenith at the centre, horizon at the rim, east on the left (as seen lying on your back, head north).
import { useEffect, useLayoutEffect, useRef } from 'react';
import { moonPhase, moonPosition, STARS, starPosition, sunPosition } from '../lib/astro';
import { skyColour } from '../lib/sky';

export interface SkyOpts {
  ms: number;
  lat: number;
  lon: number;
  low: number;
  mid: number;
  high: number;
  mm: number;
}

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Constellation figures, drawn between the real positions of their stars.
const FIGURES: [string, string][] = [
  ['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Dubhe'], ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid'],
  ['Betelgeuse', 'Bellatrix'], ['Betelgeuse', 'Alnitak'], ['Bellatrix', 'Mintaka'], ['Mintaka', 'Alnilam'], ['Alnilam', 'Alnitak'],
  ['Alnitak', 'Saiph'], ['Mintaka', 'Rigel'], ['Saiph', 'Rigel'],
  ['Caph', 'Schedar'], ['Schedar', 'Navi'], ['Navi', 'Ruchbah'], ['Ruchbah', 'Segin'],
  ['Castor', 'Pollux'], ['Vega', 'Deneb'], ['Deneb', 'Altair'], ['Altair', 'Vega'], ['Acrux', 'Gacrux'],
];
const BY_NAME = new Map(STARS.map((s) => [s[0], s]));

export function drawSky(canvas: HTMLCanvasElement, o: SkyOpts): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = canvas.clientWidth;
  if (!size) return;
  canvas.width = canvas.height = Math.round(size * dpr);
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = size / 2, R = size / 2;
  const at = (alt: number, az: number): [number, number] => {
    const r = ((90 - alt) / 90) * R, a = (az * Math.PI) / 180;
    return [c - r * Math.sin(a), c - r * Math.cos(a)];
  };
  // Bodies near the horizon are drawn just inside the rim so the window never cuts them.
  const body = (alt: number, az: number, r: number): [number, number] => {
    const [x, y] = at(alt, az), d = Math.hypot(x - c, y - c), max = R - r - Math.max(6, R * 0.05); // clear of the printed ring
    return d > max ? [c + ((x - c) * max) / d, c + ((y - c) * max) / d] : [x, y];
  };
  const sun = sunPosition(o.ms, o.lat, o.lon);
  const moon = moonPosition(o.ms, o.lat, o.lon);
  const cloud = Math.max(o.low, o.mid, o.high);
  const sky = skyColour(sun.alt, cloud);

  const grd = g.createRadialGradient(c, c, 0, c, c, R);
  grd.addColorStop(0, sky.zenith);
  grd.addColorStop(1, sky.horizon);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);

  g.strokeStyle = 'rgba(255,255,255,.12)';
  g.lineWidth = 1;
  for (const alt of [30, 60]) { g.beginPath(); g.arc(c, c, ((90 - alt) / 90) * R, 0, Math.PI * 2); g.stroke(); }

  const dark = Math.min(1, Math.max(0, (-sun.alt - 4) / 10));
  if (dark > 0.03) {
    g.strokeStyle = 'rgba(243,245,251,.32)';
    g.lineWidth = Math.max(0.8, size / 520);
    g.globalAlpha = dark * (1 - cloud / 130);
    for (const [a, b] of FIGURES) {
      const pa = starPosition(BY_NAME.get(a)!, o.ms, o.lat, o.lon), pb = starPosition(BY_NAME.get(b)!, o.ms, o.lat, o.lon);
      if (pa.alt < 0 || pb.alt < 0) continue;
      const [x1, y1] = at(pa.alt, pa.az), [x2, y2] = at(pb.alt, pb.az);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    g.globalAlpha = 1;
    g.font = `400 ${Math.max(10, size / 46)}px Jost, sans-serif`;
    for (const s of STARS) {
      const p = starPosition(s, o.ms, o.lat, o.lon);
      if (p.alt < 0) continue;
      const [x, y] = at(p.alt, p.az);
      g.globalAlpha = dark * (1 - cloud / 130);
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(x, y, Math.max(0.7, 2.6 - s[3] * 0.6), 0, Math.PI * 2); g.fill();
      if (s[3] < 0.9) { g.globalAlpha *= 0.55; g.fillText(s[0], x + 6, y + 4); }
    }
    g.globalAlpha = 1;
  }

  // Today's sun path, dotted: the day as a line across the dome.
  g.setLineDash([2, 5]); g.strokeStyle = 'rgba(255,201,46,.6)'; g.lineWidth = 1.5; g.beginPath();
  let pen = false;
  for (let k = -12; k <= 12; k += 0.25) {
    const p = sunPosition(o.ms + k * 3600e3, o.lat, o.lon);
    if (p.alt < 0) { pen = false; continue; }
    const [x, y] = at(p.alt, p.az);
    if (pen) g.lineTo(x, y); else g.moveTo(x, y);
    pen = true;
  }
  g.stroke(); g.setLineDash([]);

  if (sun.alt > -1) {
    const [x, y] = body(Math.max(0, sun.alt), sun.az, Math.max(7, R * 0.035));
    const halo = g.createRadialGradient(x, y, 2, x, y, R * 0.24);
    halo.addColorStop(0, 'rgba(255,236,190,.95)'); halo.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(x, y, R * 0.24, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(x, y, Math.max(7, R * 0.035), 0, Math.PI * 2); g.fill();
  }
  if (moon.alt > 0) {
    const [x, y] = body(moon.alt, moon.az, Math.max(7, R * 0.035));
    drawMoon(g, x, y, Math.max(7, R * 0.035), moonPhase(o.ms).phase, o.lat < 0, sun.alt > 0);
  }

  // Cloud as three veils: high cloud thin overhead, low cloud thickest toward the horizon.
  const r = rng(11);
  const lum = sun.alt > 0 ? 1 : sun.alt > -8 ? 0.5 : 0.2;
  for (const [cover, rMin, rMax, sz, a] of [[o.high, 0, 0.55, 0.05, 0.22], [o.mid, 0.3, 0.8, 0.09, 0.3], [o.low, 0.6, 1, 0.13, 0.42]] as const) {
    for (let i = 0; i < Math.round(cover / 3); i++) {
      const ang = r() * Math.PI * 2, rr = R * (rMin + (rMax - rMin) * r());
      const x = c + Math.cos(ang) * rr, y = c + Math.sin(ang) * rr, big = R * sz * (1 + r() * 1.6);
      const cg = g.createRadialGradient(x, y, 0, x, y, big);
      cg.addColorStop(0, `rgba(225,230,240,${a * lum})`); cg.addColorStop(1, 'rgba(225,230,240,0)');
      g.fillStyle = cg; g.beginPath(); g.arc(x, y, big, 0, Math.PI * 2); g.fill();
    }
  }
  if (o.mm >= 0.05) {
    g.strokeStyle = `rgba(220,228,245,${Math.min(0.7, 0.3 + o.mm / 3)})`;
    g.lineWidth = 1;
    for (let i = 0; i < Math.min(400, 80 + o.mm * 120); i++) {
      const x = r() * size, y = r() * size;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 10); g.stroke();
    }
  }

  // Compass on the window's edge.
  g.fillStyle = 'rgba(255,255,255,.78)';
  g.font = `500 ${Math.max(11, size / 30)}px Jost, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [label, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as const) {
    const a = (az * Math.PI) / 180, rr = R - Math.max(14, size / 24);
    g.fillText(label, c - rr * Math.sin(a), c - rr * Math.cos(a));
  }
}

export function drawMoon(g: CanvasRenderingContext2D, x: number, y: number, r: number, phase: number, south: boolean, day: boolean) {
  g.save(); g.translate(x, y); if (south) g.scale(-1, 1);
  g.fillStyle = day ? 'rgba(255,255,255,.25)' : 'rgba(10,16,40,.85)';
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  const waxing = phase < 0.5, k = Math.cos(phase * 2 * Math.PI);
  g.fillStyle = day ? 'rgba(255,255,255,.85)' : '#f5f2e6';
  g.beginPath();
  g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, !waxing);
  g.ellipse(0, 0, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === waxing);
  g.fill(); g.restore();
}

export function SkyWindow({ label, ...o }: SkyOpts & { label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const opts = useRef(o);
  opts.current = o;

  useLayoutEffect(() => {
    const el = canvas.current!;
    const ro = new ResizeObserver(() => drawSky(el, opts.current));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let live = true;
    document.fonts.ready.then(() => live && canvas.current && drawSky(canvas.current, opts.current));
    return () => { live = false; };
  }, [o.ms, o.lat, o.lon, o.low, o.mid, o.high, o.mm]);

  return <canvas ref={canvas} role="img" aria-label={label} />;
}
