import { describe, expect, it } from 'vitest';
import { parseFrames, rainColour, rainIntensity } from '../src/lib/rainviewer';
import fixture from './fixtures/rainviewer.json';

it('lists every past radar frame as a tile URL template, oldest first', () => {
  const frames = parseFrames(fixture);
  expect(frames).toHaveLength(fixture.radar.past.length);
  expect(frames.every((f) => f.url.startsWith(`${fixture.host}/v2/radar/`) && f.url.endsWith('/256/{z}/{x}/{y}/2/1_1.png'))).toBe(true);
  expect(frames.map((f) => f.time)).toEqual([...frames.map((f) => f.time)].sort((a, b) => a - b));
  expect(frames[0]!.time).toBe(fixture.radar.past[0]!.time * 1000);
});
it('returns no frames for an unexpected response', () => {
  expect(parseFrames({})).toEqual([]);
  expect(parseFrames(null)).toEqual([]);
});

describe('repainting radar in the world’s palette', () => {
  const PALE = [136, 221, 238] as const, DEEP = [0, 98, 149] as const, YELLOW = [255, 238, 0] as const, RED = [255, 0, 0] as const;
  it('ranks RainViewer’s colours from light rain to downpour', () => {
    expect(rainIntensity(...PALE)).toBeLessThan(rainIntensity(...DEEP));
    expect(rainIntensity(...DEEP)).toBeLessThan(rainIntensity(...YELLOW));
    expect(rainIntensity(...YELLOW)).toBeLessThan(rainIntensity(...RED));
    expect(rainIntensity(...RED)).toBeLessThanOrEqual(1);
    expect(rainIntensity(...PALE)).toBeGreaterThan(0);
  });
  it('paints every intensity in rain blue to print white, never yellow', () => {
    for (const c of [PALE, DEEP, YELLOW, RED]) {
      const [r, , b, a] = rainColour(rainIntensity(c[0], c[1], c[2]));
      expect(b).toBeGreaterThanOrEqual(r);
      expect(a).toBeGreaterThan(0);
    }
    expect(rainColour(1)[3]).toBeGreaterThan(rainColour(0.1)[3]);
  });
});
