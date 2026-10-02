import { describe, expect, it } from 'vitest';
import { HOLD, nightfall, skyTime, zoneCity } from '../src/about/model';
import { ZONES } from '../src/about/zones';

describe('zoneCity', () => {
  it('reads the city a zone is named after', () => {
    expect(zoneCity('America/New_York')).toBe('New York');
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
    expect(zoneCity('Asia/Calcutta')).toBe('Kolkata');
  });
  it('places every time zone a browser can report without asking the network', () => {
    const missing = Intl.supportedValuesOf('timeZone').filter((z) => { const c = zoneCity(z); return c && !ZONES[c]; });
    expect(missing).toEqual([]);
  });
  it('has no city for UTC-style zones', () => {
    expect(zoneCity('UTC')).toBeUndefined();
    expect(zoneCity('Etc/GMT+5')).toBeUndefined();
    expect(zoneCity(undefined)).toBeUndefined();
  });
});

// A day where the sun peaks at 60° at noon and bottoms out at -40° at midnight; `start` is the local hour of "now".
const day = (start: number) => (h: number) => 10 + 50 * Math.cos((2 * Math.PI * (start + h - 12)) / 24);
const share = (hours: (p: number) => number, from: number, to: number) => {
  let n = 0;
  for (let i = 0; i <= 1000; i++) { const h = hours(i / 1000); if (h >= from && h <= to) n++; }
  return n / 1001;
};
// Hours ahead at which the falling sun is at +6° and at -12°.
const dusk = (alt: (h: number) => number) => {
  let a = NaN, b = NaN;
  for (let h = 1 / 600; h <= 23; h += 1 / 600) {
    if (Number.isNaN(a) && alt(h - 1 / 600) > 6 && alt(h) <= 6) a = h; // the sun crossing 6° on its way down
    if (!Number.isNaN(a) && alt(h) <= -12) { b = h; break; }
  }
  return [a, b] as const;
};

describe('skyTime', () => {
  it('holds still only briefly, then runs from now to the last hour', () => {
    const t = skyTime(day(9));
    expect(HOLD).toBeLessThanOrEqual(0.05);
    expect(t(0)).toBe(0);
    expect(t(HOLD)).toBe(0);
    expect(t(1)).toBeCloseTo(23, 5);
  });
  it('moves forward on the very first scroll past the hold', () => {
    expect(skyTime(day(9))(HOLD + 0.01)).toBeGreaterThan(0);
  });
  it('never runs backwards', () => {
    const t = skyTime(day(15));
    for (let p = 0; p < 1; p += 0.01) expect(t(p + 0.01)).toBeGreaterThanOrEqual(t(p));
  });
  it('gives dusk (sun 6° up to 12° down) about a quarter of the turn', () => {
    for (const start of [9, 14]) {
      const alt = day(start), [a, b] = dusk(alt);
      expect(share(skyTime(alt), a, b)).toBeGreaterThan(0.2);
      expect(share(skyTime(alt), a, b)).toBeLessThan(0.36);
    }
  });
  it('lands sunset mid-turn even when the visitor arrives after dark', () => {
    const alt = day(22), [a, b] = dusk(alt), t = skyTime(alt);
    let mid = 0;
    for (let p = 0; p <= 1; p += 0.001) if (t(p) <= (a + b) / 2) mid = p;
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.7);
  });
  it('falls back to clock time when no sunset falls in the window', () => {
    const t = skyTime(() => 40);
    expect(t(HOLD)).toBe(0);
    expect(t(1)).toBeCloseTo(23, 5);
    expect(t(0.5)).toBeGreaterThan(9);
    expect(t(0.5)).toBeLessThan(14);
  });
});

describe('nightfall', () => {
  it('finds when the sun next sinks past 6° below the horizon', () => {
    const h = nightfall(day(14)); // 2 pm local in the synthetic day
    expect(h).toBeGreaterThan(4);
    expect(h).toBeLessThan(7);
    expect(day(14)(h!)).toBeCloseTo(-6, 0);
  });
  it('skips the night already under way and finds the next one', () => {
    expect(nightfall(day(22))!).toBeGreaterThan(18);
  });
  it('has none without a sunset in the window', () => {
    expect(nightfall(() => 40)).toBeNull();
  });
});
