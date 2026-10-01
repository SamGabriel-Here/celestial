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
