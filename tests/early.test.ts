import { afterEach, expect, it, vi } from 'vitest';
import { startEarly } from '../src/lib/early';
import tokyo from './fixtures/tokyo.json';
import airTokyo from './fixtures/air-tokyo.json';
import springfield from './fixtures/geocode-springfield.json';

const TOKYO = { id: '35.68,139.69', name: 'Tokyo', country: 'JP', lat: 35.68, lon: 139.69 };
function storage(last?: typeof TOKYO): Storage {
  const m = new Map<string, string>(last ? [['celestial:v1', JSON.stringify({ v: 1, unit: 'c', saved: [], last })]] : []);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: m.size } as Storage;
}
function fakeFetch() {
  const urls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (u: string) => {
    urls.push(u);
    const body = u.includes('geocoding') ? springfield : u.includes('air-quality') ? airTokyo : tokyo;
    return { ok: true, json: async () => body } as Response;
  }));
  return urls;
}
afterEach(() => vi.unstubAllGlobals());

it('reopening the last place starts the forecast at once, with no place search', async () => {
  const urls = fakeFetch();
  const early = startEarly('https://x/?q=Tokyo', storage(TOKYO))!;
  expect((await early.place)?.id).toBe(TOKYO.id);
  expect((await early.forecast).hours.length).toBe(384);
  expect(urls.some((u) => u.includes('geocoding'))).toBe(false);
});
it('a new place is searched first, then forecast', async () => {
  const urls = fakeFetch();
  const early = startEarly('https://x/?q=Springfield', storage())!;
  expect((await early.place)?.region).toBe('Missouri');
  await early.forecast;
  expect(urls[0]).toContain('geocoding');
});
it('starts nothing when no place is known', () => {
  fakeFetch();
  expect(startEarly('https://x/', storage())).toBeUndefined();
});

it('a shared link opens the same-named place at its coordinates, not the first match', async () => {
  fakeFetch();
  const early = startEarly('https://x/?q=Springfield&at=39.80172,-89.64371', storage())!;
  expect((await early.place)?.region).toBe('Illinois');
});
it('a link to someone else’s Springfield ignores the viewer’s own last Springfield', async () => {
  fakeFetch();
  const mine = { id: '37.22,-93.30', name: 'Springfield', country: 'US', lat: 37.21533, lon: -93.29824 };
  const early = startEarly('https://x/?q=Springfield&at=39.80172,-89.64371', storage(mine as typeof TOKYO))!;
  expect((await early.place)?.region).toBe('Illinois');
});
