import { expect, it } from 'vitest';
import { parseFrames } from '../src/lib/rainviewer';
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
