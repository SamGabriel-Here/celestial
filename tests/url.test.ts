import { expect, it } from 'vitest';
import { buildUrl, parseUrl, type AppUrl } from '../src/lib/url';

const roundTrip = (u: AppUrl) => expect(parseUrl(buildUrl(u))).toEqual(u);

it('round-trips names with accents and non-Latin scripts', () => {
  roundTrip({ q: 'São Paulo', view: 'air', t: 12 });
  roundTrip({ q: '東京', view: 'now', t: 0 });
});
it('round-trips coordinates', () => roundTrip({ at: { lat: -33.87, lon: 151.21 }, view: 'radar', t: 0 }));
it('falls back to the Now view for an unknown hash', () => expect(parseUrl('/?q=x#/nope').view).toBe('now'));
it('clamps the cursor into the 36-hour window', () => {
  expect(parseUrl('/?q=x&t=99').t).toBe(35);
  expect(parseUrl('/?q=x&t=-4').t).toBe(0);
  expect(parseUrl('/?q=x&t=abc').t).toBe(0);
});
it('ignores malformed coordinates', () => expect(parseUrl('/?at=north,south').at).toBeUndefined());
it('leaves t out of the URL at zero', () => expect(buildUrl({ q: 'Oslo', view: 'days', t: 0 })).toBe('/?q=Oslo#/days'));
