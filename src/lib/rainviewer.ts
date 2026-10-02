export interface Frame {
  time: number; // UTC ms
  url: string; // Leaflet tile template
}

const MAPS = 'https://api.rainviewer.com/public/weather-maps.json';

/** Past radar frames (about two hours, every ten minutes), oldest first. */
export function parseFrames(json: unknown): Frame[] {
  const j = json as { host?: string; radar?: { past?: { time: number; path: string }[] } } | null;
  if (!j?.host || !Array.isArray(j.radar?.past)) return [];
  return j.radar.past
    .map((p) => ({ time: p.time * 1000, url: `${j.host}${p.path}/256/{z}/{x}/{y}/2/1_1.png` }))
    .sort((a, b) => a.time - b.time);
}

export async function fetchFrames(): Promise<Frame[]> {
  const r = await fetch(MAPS);
  if (!r.ok) throw new Error('Radar unavailable');
  return parseFrames(await r.json());
}

/**
 * RainViewer's palette runs pale cyan (light rain) → deep blue (heavier) → yellow, orange, red
 * (downpour) → magenta (extreme). Rank a pixel along that ramp, 0..1.
 */
export function rainIntensity(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (b >= r && b >= g * 0.6) {
    // The blue ramp: the darker the blue, the heavier the rain.
    const light = (max + min) / 510; // 0..1
    return Math.min(0.6, Math.max(0.1, 0.1 + (0.75 - light) * 1.1));
  }
  if (r > g && b > g) return 1; // magenta: extreme
  // Warm end: yellow (hue ≈ 55°) → red (0°).
  const hue = max === min ? 0 : 60 * ((g - b) / (max - min));
  return Math.min(0.98, 0.7 + 0.28 * (1 - Math.max(0, Math.min(60, hue)) / 60));
}

/** Rain blue at the light end to print white at the heavy end; RGBA, alpha 0..255. */
export function rainColour(i: number): [number, number, number, number] {
  const t = Math.max(0, Math.min(1, i));
  // Rain blue up to heavy rain; only the downpour end (the warm half of RainViewer's ramp)
  // whitens toward print white. Mostly opaque: translucent blue over a dark map reads as grey.
  const w = Math.max(0, (t - 0.65) / 0.35);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * w);
  return [mix(160, 243), mix(205, 245), mix(255, 251), Math.round(255 * (0.78 + 0.22 * t))];
}
