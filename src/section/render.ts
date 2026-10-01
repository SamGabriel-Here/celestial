// The atmosphere section, drawn on a canvas. The sky (colour, cloud, rain, freezing level) is
// painted once per data change into an offscreen layer; ruler, surface strip and cursor are an
// overlay, so moving the cursor never repaints the sky.
import { altitudeY, cloudBase, TOP_M, type Column } from '../lib/columns';
import { skyColour } from '../lib/sky';
import { weekday } from '../lib/units';

export const RULER = 34;
export const SURFACE = 150;
export const GUTTER = 44; // paper strip on the right carrying the altitude scale

export interface SectionOpts {
  kind: 'hours' | 'days';
  reduced: boolean;
  fmtTemp: (c: number) => string;
}

export interface SectionApi {
  setData(cols: Column[], opts: SectionOpts): void;
  setCursor(i: number): void;
  resize(): void;
  destroy(): void;
}

const PAPER = '#f3f2ec', INK = '#11141b', INK2 = '#5b606b', RULE = '#d6d4ca', FREEZE = '#0091c2', RAIN = '#2f6fd6', SUN = '#c98a00';
const SANS = "'Chivo', system-ui, sans-serif";
const MONO = "'Chivo Mono', ui-monospace, monospace";
const BANDS = { high: [6000, 12000], mid: [2000, 6000], low: [0, 2000] } as const;

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const daylight = (alt: number) => (alt > 0 ? 1 : alt > -8 ? 0.62 : 0.34);

export function createSection(canvas: HTMLCanvasElement): SectionApi {
  const ctx = canvas.getContext('2d')!;
  let cols: Column[] = [];
  let opts: SectionOpts = { kind: 'hours', reduced: true, fmtTemp: (c) => `${Math.round(c)}°` };
  let cursor = 0;
  let w = 0, h = 0, dpr = 1;
  let sky: HTMLCanvasElement | null = null;
  let reveal = 1;
  let raf = 0;
  let developed = false;

  const skyW = () => w - GUTTER;
  const skyH = () => h - RULER - SURFACE;
  const colW = () => skyW() / Math.max(1, cols.length);

  function measure() {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, r.width);
    h = Math.max(RULER + SURFACE + 60, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function paintSky() {
    sky = document.createElement('canvas');
    sky.width = Math.round(skyW() * dpr);
    sky.height = Math.round(skyH() * dpr);
    const g = sky.getContext('2d')!;
    g.scale(dpr, dpr);
    const H = skyH(), cw = colW();
    const Y = (m: number) => altitudeY(m, 0, H);

    cols.forEach((c, i) => {
      const col = skyColour(c.sunAlt, 0);
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, col.zenith);
      grd.addColorStop(1, col.horizon);
      g.fillStyle = grd;
      g.fillRect(Math.floor(i * cw), 0, Math.ceil(cw) + 1, H);
    });

    // Cloud: each deck at its true altitude band, puff count from cover, lit by that column's sun.
    const scale = opts.kind === 'days' ? 2.2 : 1;
    cols.forEach((c, i) => {
      const lum = daylight(c.sunAlt);
      for (const k of ['high', 'mid', 'low'] as const) {
        const [b0, b1] = BANDS[k];
        const r = rng(i * 7919 + k.length * 104729 + 1);
        const n = Math.round(c[k] / (k === 'high' ? 9 : 6) * scale);
        for (let j = 0; j < n; j++) {
          const x = (i + r()) * cw;
          const y = Y(b0 + (b1 - b0) * (k === 'low' ? 0.25 + r() * 0.6 : r()));
          const rx = cw * (k === 'high' ? 1.6 : 1.05) * (0.7 + r());
          const ry = (k === 'high' ? 5 : k === 'mid' ? 14 : 22) * (0.6 + r()) * (H / 600);
          const a = (k === 'high' ? 0.28 : 0.42) * lum;
          const v = Math.round(242 * lum + 10);
          const cg = g.createRadialGradient(x, y, 0, x, y, rx);
          cg.addColorStop(0, `rgba(${v},${v},${v + 4},${a})`);
          cg.addColorStop(1, `rgba(${v},${v},${v + 4},0)`);
          g.fillStyle = cg;
          g.beginPath();
          g.ellipse(x, y, rx, Math.max(2, ry), 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (c.mm >= 0.05) { // rain from the cloud base to the ground
        const r = rng(i * 31 + 7);
        const base = Y(cloudBase(c));
        const perHour = opts.kind === 'days' ? c.mm / 24 : c.mm;
        g.strokeStyle = `rgba(190,215,255,${Math.min(0.85, 0.3 + perHour / 2)})`;
        g.lineWidth = 1.2;
        const drops = Math.min(60, 6 + perHour * 18) * scale;
        for (let j = 0; j < drops; j++) {
          const x = (i + r()) * cw, y = base + r() * (H - base - 8);
          g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + 9); g.stroke();
        }
      }
    });

    // Freezing level: the one accent line, broken where the model has no value.
    g.strokeStyle = FREEZE;
    g.lineWidth = 2.5;
    g.beginPath();
    let pen = false;
    cols.forEach((c, i) => {
      if (c.freeze === null) { pen = false; return; }
      const x = (i + 0.5) * cw, y = Y(Math.min(TOP_M, c.freeze));
      if (pen) g.lineTo(x, y); else g.moveTo(x, y);
      pen = true;
    });
    g.stroke();
  }

  // Sunrise and sunset fall between two columns where the sun crosses the horizon.
  function horizonCrossings(): { x: number; rise: boolean }[] {
    if (opts.kind !== 'hours') return [];
    const out: { x: number; rise: boolean }[] = [];
    const cw = colW();
    for (let i = 1; i < cols.length; i++) {
      const a = cols[i - 1]!.sunAlt, b = cols[i]!.sunAlt;
      if ((a < 0) !== (b < 0)) out.push({ x: (i - 0.5 + a / (a - b)) * cw, rise: b > a });
    }
    return out;
  }

  function paint() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    const W = skyW(), H = skyH(), cw = colW();

    if (sky) { // develop: the sky fills in from the ground up
      const shown = H * reveal;
      ctx.drawImage(sky, 0, (H - shown) * dpr, sky.width, shown * dpr, 0, RULER + H - shown, W, shown);
    }

    // Ruler
    ctx.fillStyle = INK2;
    ctx.font = `500 12px ${MONO}`;
    ctx.textBaseline = 'alphabetic';
    cols.forEach((c, i) => {
      const x = i * cw;
      const day = c.dayLabel ?? (i === 0 && opts.kind === 'hours' ? weekday(c.iso) : undefined);
      if (day) {
        ctx.fillStyle = INK; ctx.fillRect(x, 0, 1.5, RULER);
        ctx.font = `600 12px ${SANS}`; ctx.fillText(day, x + 5, 14);
        ctx.font = `500 12px ${MONO}`; ctx.fillStyle = INK2;
      }
      const every = opts.kind === 'days' ? 1 : 3;
      if (opts.kind === 'days' || Number(c.label.slice(0, 2)) % every === 0) {
        ctx.fillText(opts.kind === 'days' ? c.label : c.label.slice(0, 2), x + 4, 28);
        ctx.fillRect(x, RULER - 5, 1, 5);
      }
    });
    for (const s of horizonCrossings()) {
      ctx.fillStyle = SUN;
      ctx.beginPath(); ctx.arc(s.x, RULER - 1, 4.5, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = RULE; ctx.fillRect(0, RULER - 0.5, w, 1);

    // Altitude gutter
    ctx.fillStyle = INK2; ctx.font = `400 11px ${MONO}`; ctx.textAlign = 'right';
    for (const km of [2, 4, 6, 8, 10]) {
      const y = RULER + altitudeY(km * 1000, 0, H);
      ctx.fillRect(W, y, 6, 1);
      ctx.fillText(`${km} km`, w - 4, y + 4);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = RULE; ctx.fillRect(W, RULER, 1, H);

    // Freezing level label on a paper tag, at the left edge
    const f0 = cols.find((c) => c.freeze !== null)?.freeze;
    if (f0 != null && sky) {
      const y = RULER + altitudeY(Math.min(TOP_M, f0), 0, H);
      const text = `0 °C at ${(f0 / 1000).toFixed(1)} km`;
      ctx.font = `500 11px ${MONO}`;
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = PAPER; ctx.fillRect(6, y - 22, tw + 12, 18);
      ctx.fillStyle = FREEZE; ctx.fillText(text, 12, y - 9);
    }

    paintSurface(cw);

    // Cursor
    if (cols.length) {
      const x = (cursor + 0.5) * cw;
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(x - 0.75, RULER, 1.5, H);
      ctx.fillStyle = INK; ctx.fillRect(x - 0.75, RULER + H, 1.5, SURFACE);
    }
  }

  function paintSurface(cw: number) {
    const top = RULER + skyH();
    ctx.fillStyle = RULE; ctx.fillRect(0, top, w, 1);
    ctx.fillStyle = INK2; ctx.font = `400 12px ${SANS}`;
    ctx.fillText(opts.kind === 'days' ? 'High and low, rain at the ground' : 'Temperature and rain at the ground', 10, top + 18);
    if (!cols.length) return;

    // Rain bars along the ground: height is the amount, strength the chance.
    const maxMm = Math.max(1, ...cols.map((c) => c.mm));
    cols.forEach((c, i) => {
      if ((c.pop ?? 0) < 10 && c.mm < 0.1) return;
      const bh = Math.max(3, (c.mm / maxMm) * 36);
      ctx.globalAlpha = 0.3 + ((c.pop ?? 50) / 100) * 0.7;
      ctx.fillStyle = RAIN;
      ctx.fillRect(i * cw + cw * 0.2, top + SURFACE - 6 - bh, cw * 0.6, bh);
    });
    ctx.globalAlpha = 1;

    const temps = cols.flatMap((c) => (c.tempMin != null ? [c.temp, c.tempMin] : [c.temp]));
    const lo = Math.min(...temps) - 1, hi = Math.max(...temps) + 1;
    const Y = (t: number) => top + 34 + (1 - (t - lo) / (hi - lo)) * (SURFACE - 84);
    ctx.font = `500 12px ${MONO}`; ctx.textAlign = 'center'; ctx.fillStyle = INK;

    if (opts.kind === 'days') {
      cols.forEach((c, i) => {
        const x = (i + 0.5) * cw;
        ctx.fillStyle = INK; ctx.fillRect(x - 2, Y(c.temp), 4, Math.max(2, Y(c.tempMin ?? c.temp) - Y(c.temp)));
        ctx.fillText(opts.fmtTemp(c.temp), x, Y(c.temp) - 6);
        ctx.fillStyle = INK2; ctx.fillText(opts.fmtTemp(c.tempMin ?? c.temp), x, Y(c.tempMin ?? c.temp) + 15);
      });
    } else {
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath();
      cols.forEach((c, i) => { const x = (i + 0.5) * cw; if (i) ctx.lineTo(x, Y(c.temp)); else ctx.moveTo(x, Y(c.temp)); });
      ctx.stroke();
      cols.forEach((c, i) => {
        if (i % 3) return;
        const x = (i + 0.5) * cw;
        ctx.beginPath(); ctx.arc(x, Y(c.temp), 3, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = x < 18 ? 'left' : 'center'; // keep the first label inside the frame
        ctx.fillText(opts.fmtTemp(c.temp), x < 18 ? 2 : x, Y(c.temp) - 9);
      });
    }
    ctx.textAlign = 'left';
  }

  function develop() {
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      reveal = 1 - Math.pow(2, -10 * p);
      if (p >= 1) reveal = 1;
      paint();
      if (p < 1) raf = requestAnimationFrame(step);
    };
    reveal = 0;
    raf = requestAnimationFrame(step);
  }

  return {
    setData(next, o) {
      cols = next;
      opts = o;
      cursor = Math.min(cursor, Math.max(0, cols.length - 1));
      measure();
      paintSky();
      if (!developed && !o.reduced && cols.length) { developed = true; develop(); }
      else { developed = true; paint(); }
    },
    setCursor(i) { cursor = Math.max(0, Math.min(cols.length - 1, i)); if (reveal >= 1) paint(); },
    resize() { if (!cols.length) return; measure(); paintSky(); paint(); },
    destroy() { cancelAnimationFrame(raf); },
  };
}
