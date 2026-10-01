import { describe, expect, it } from 'vitest';
import { outlook } from '../src/lib/outlook';
import type { Forecast, Hour } from '../src/lib/types';

// A Tokyo-like place (+09:00). "Now" is 10:00 local on 1 Oct 2026.
const OFF = 9 * 3600;
const NOW = Date.UTC(2026, 9, 1, 1, 0);
const pad = (n: number) => String(n).padStart(2, '0');
function isoAt(hoursFromNow: number) {
  const d = new Date(NOW + OFF * 1000 + hoursFromNow * 3600e3);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function forecast(opts: { wetHours?: Record<number, Partial<Hour>>; wetQuarter?: number; mmNow?: number } = {}): Forecast {
  const hours: Hour[] = Array.from({ length: 30 }, (_, i) => ({
    ms: NOW + (i - 1) * 3600e3, iso: isoAt(i - 1), temp: 20, pop: 5, mm: 0, code: 2, low: 0, mid: 0, high: 0,
    wind: 5, gust: 8, dir: 0, uv: 1, freeze: 4000, ...(opts.wetHours?.[i - 1] ?? {}),
  }));
  const quarters = Array.from({ length: 8 }, (_, i) => ({ ms: NOW + i * 900e3, iso: isoAt(i / 4), mm: i === opts.wetQuarter ? 0.4 : 0 }));
  return {
    place: { id: 'x', name: 'Tokyo', country: 'JP', lat: 35.68, lon: 139.69 }, offsetSec: OFF, fetchedAt: NOW, asOf: isoAt(0), hours, quarters, days: [],
    current: { temp: 20, feels: 20, rh: 60, code: 2, cloud: 40, wind: 5, gust: 8, dir: 0, mm: opts.mmNow ?? 0, pressure: 1013 },
  };
}
const wet = { mm: 1, pop: 80, code: 61 };

describe('outlook', () => {
  it('says when rain eases if it is raining now', () => {
    const f = forecast({ mmNow: 0.6, wetHours: { 0: wet, 1: wet, 2: wet, 3: wet, 4: wet } });
    expect(outlook(f, NOW)).toBe('Rain now, easing by 15:00');
  });
  it('says rain lasts when no dry hour comes within a day', () => {
    const all = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i - 1, wet]));
    expect(outlook(forecast({ mmNow: 0.6, wetHours: all }), NOW)).toBe('Rain now, and through the next 24 hours');
  });
  it('gives the quarter-hour rain starts within two hours', () => {
    expect(outlook(forecast({ wetQuarter: 3 }), NOW)).toBe('Rain from 10:45');
  });
  it('says how long it stays dry today', () => {
    expect(outlook(forecast({ wetHours: { 8: wet } }), NOW)).toBe('Dry until 18:00, then light rain');
  });
  it('says "tomorrow" when the rain arrives after local midnight', () => {
    expect(outlook(forecast({ wetHours: { 20: { mm: 0.3, pop: 70, code: 51 } } }), NOW)).toBe('Dry until 06:00 tomorrow, then light drizzle');
  });
  it('ignores rain that has already passed', () => {
    expect(outlook(forecast({ wetHours: { [-1]: wet } }), NOW)).toBe('Dry for the next 24 hours');
  });
  it('says "rain likely" when only the chance is high', () => {
    expect(outlook(forecast({ wetHours: { 8: { pop: 60, code: 3 } } }), NOW)).toBe('Dry until 18:00, then rain likely');
  });
  it('says rain is likely within the hour when the current hour is wet but it is not raining yet', () => {
    expect(outlook(forecast({ wetHours: { 0: { pop: 60, code: 61 } } }), NOW)).toBe('Light rain likely within the hour');
  });
  it('treats an unknown chance of rain as dry', () => {
    expect(outlook(forecast({ wetHours: { 8: { pop: null } } }), NOW)).toBe('Dry for the next 24 hours');
  });
});
