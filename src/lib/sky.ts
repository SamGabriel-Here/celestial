type Rgb = [number, number, number];

// Sky colour by sun altitude: [altitude°, zenith, horizon].
const STOPS: [number, Rgb, Rgb][] = [
  [-18, [6, 9, 22], [12, 16, 34]],
  [-8, [14, 22, 56], [52, 44, 84]],
  [-2, [36, 52, 104], [214, 120, 88]],
  [4, [64, 112, 176], [236, 176, 128]],
  [15, [58, 124, 204], [168, 202, 228]],
  [60, [38, 110, 210], [150, 196, 236]],
];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as Rgb;
const grey = (c: Rgb): Rgb => { const l = (c[0] + c[1] + c[2]) / 3; return [l, l, l * 1.04]; };
const css = (c: Rgb) => `rgb(${c.map((v) => Math.round(Math.min(255, v))).join(',')})`;

/** Zenith and horizon colour for a sun altitude, greyed toward overcast by cloud cover (0–100). */
export function skyColour(sunAlt: number, cloudPct: number): { zenith: string; horizon: string } {
  let i = STOPS.findIndex((s) => s[0] > sunAlt);
  if (i === -1) i = STOPS.length - 1;
  if (i === 0) i = 1;
  const [a0, z0, h0] = STOPS[i - 1]!;
  const [a1, z1, h1] = STOPS[i]!;
  const t = Math.min(1, Math.max(0, (sunAlt - a0) / (a1 - a0)));
  const k = (Math.min(100, Math.max(0, cloudPct)) / 100) * 0.75;
  const z = mix(z0, z1, t);
  const h = mix(h0, h1, t);
  return { zenith: css(mix(z, grey(z), k)), horizon: css(mix(h, grey(h), k)) };
}
