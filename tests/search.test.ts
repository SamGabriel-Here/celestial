import { expect, it } from 'vitest';
import { locationMessage, pickOption } from '../src/lib/search';

const PARIS = { id: 'p', name: 'Paris', country: 'FR', lat: 48.85, lon: 2.35 };
const PARMA = { id: 'm', name: 'Parma', country: 'IT', lat: 44.8, lon: 10.33 };

it('uses suggestions only when they belong to what is typed now', () => {
  expect(pickOption([PARIS], 'Par', 'Parma', -1)).toBeUndefined();
  expect(pickOption([PARMA], 'Parma', 'Parma ', -1)).toBe(PARMA);
  expect(pickOption([PARIS, PARMA], 'Par', 'Par', 1)).toBe(PARMA);
});
it('explains a refused location differently from one that could not be found', () => {
  expect(locationMessage(1)).toMatch(/allow/i);
  expect(locationMessage(2)).toMatch(/couldn.t find/i);
  expect(locationMessage(3)).toMatch(/couldn.t find/i);
});
