// The sky overhead as a dome: zenith at the centre, horizon at the rim, east on the left
// (it is drawn as you see it lying on your back with your head to the north).
import { moonPhase, moonPosition, STARS, starPosition, sunPosition } from '../lib/astro';
import { skyColour } from '../lib/sky';

const PAPER = '#f3f2ec', INK = '#11141b', INK2 = '#5b606b';
const SANS = "'Chivo', system-ui, sans-serif";

export interface DomeOpts {
  ms: number;
  lat: number;
  lon: number;
  cloudPct: number;
}

export function drawDome(canvas: HTMLCanvasElement, o: DomeOpts): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = canvas.clientWidth;
  canvas.width = canvas.height = Math.round(size * dpr);
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = size / 2, R = size / 2 - 30;
  const at = (alt: number, az: number): [number, number] => {
    const r = ((90 - alt) / 90) * R, a = (az * Math.PI) / 180;
    return [c - r * Math.sin(a), c - r * Math.cos(a)];
  };

  g.fillStyle = PAPER;
  g.fillRect(0, 0, size, size);

  const sun = sunPosition(o.ms, o.lat, o.lon);
  const moon = moonPosition(o.ms, o.lat, o.lon);
  const phase = moonPhase(o.ms);
  const sky = skyColour(sun.alt, o.cloudPct);

  g.save();
  g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.clip();
  const grd = g.createRadialGradient(c, c, 0, c, c, R);
  grd.addColorStop(0, sky.zenith); grd.addColorStop(1, sky.horizon);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);

  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
  for (const alt of [30, 60]) { g.beginPath(); g.arc(c, c, ((90 - alt) / 90) * R, 0, Math.PI * 2); g.stroke(); }

  const dark = Math.min(1, Math.max(0, (-sun.alt - 4) / 10)) * (1 - o.cloudPct / 130);
  if (dark > 0.03) {
    g.fillStyle = '#fff';
    for (const s of STARS) {
      const p = starPosition(s, o.ms, o.lat, o.lon);
      if (p.alt < 0) continue;
      const [x, y] = at(p.alt, p.az);
      g.globalAlpha = dark * Math.min(1, 1.2 - s[3] * 0.25);
      g.beginPath(); g.arc(x, y, Math.max(0.7, 2.6 - s[3] * 0.6), 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }

  // Today's sun path, dotted: the day as a line across the dome.
  g.setLineDash([2, 5]); g.strokeStyle = 'rgba(255,201,46,.7)'; g.lineWidth = 1.5; g.beginPath();
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
    const [x, y] = at(Math.max(0, sun.alt), sun.az);
    const halo = g.createRadialGradient(x, y, 2, x, y, R * 0.22);
    halo.addColorStop(0, 'rgba(255,236,190,.95)'); halo.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(x, y, R * 0.22, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill();
  }
  if (moon.alt > 0) {
    const [x, y] = at(moon.alt, moon.az);
    drawMoon(g, x, y, 11, phase.phase, o.lat < 0, sun.alt > 0);
  }

  // Cloud as an even veil over the dome: the dome is a moment, not a forecast of where cloud sits.
  g.fillStyle = `rgba(214,218,226,${(o.cloudPct / 100) * 0.55})`;
  g.fillRect(0, 0, size, size);
  g.restore();

  g.strokeStyle = INK; g.lineWidth = 1.5;
  g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.stroke();
  g.fillStyle = INK2; g.font = `600 13px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [label, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as const) {
    const a = (az * Math.PI) / 180;
    g.fillText(label, c - (R + 16) * Math.sin(a), c - (R + 16) * Math.cos(a));
  }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}

function drawMoon(g: CanvasRenderingContext2D, x: number, y: number, r: number, phase: number, south: boolean, day: boolean) {
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
