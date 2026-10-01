import { describe, expect, it } from 'vitest';
import { STARS, moonPhase, phaseName, starPosition, sunEvents, sunPosition } from '../src/lib/astro';

describe('astro', () => {
  it('puts the solstice noon sun at ~62° due south over Greenwich', () => {
    const s = sunPosition(Date.UTC(2026, 5, 21, 12), 51.48, 0);
    expect(s.alt).toBeCloseTo(62, 0);
    expect(Math.abs(s.az - 180)).toBeLessThan(3);
  });
  it('knows a full moon from a new moon', () => {
    expect(moonPhase(Date.UTC(2025, 0, 13, 22, 27)).lit).toBeGreaterThan(0.99);
    expect(moonPhase(Date.UTC(2025, 0, 29, 12, 36)).lit).toBeLessThan(0.01);
    expect(phaseName(0.5)).toBe('Full moon');
    expect(phaseName(0)).toBe('New moon');
  });
  it('holds Polaris at the observer’s latitude', () => {
    const polaris = STARS.find((s) => s[0] === 'Polaris')!;
    // Polaris is 0.74° from the pole, so it circles within that distance of the latitude.
    for (const h of [0, 6, 12, 18]) {
      const alt = starPosition(polaris, Date.UTC(2026, 9, 1, h), 64.14, -21.94).alt;
      expect(Math.abs(alt - 64.14)).toBeLessThanOrEqual(0.75);
    }
  });
  it('reports polar night and midnight sun instead of bogus times', () => {
    expect(sunEvents(Date.UTC(2026, 11, 21, 0), 69.65, 18.96).polar).toBe('night');
    expect(sunEvents(Date.UTC(2026, 5, 21, 0), 69.65, 18.96).polar).toBe('day');
    const g = sunEvents(Date.UTC(2026, 5, 21, 0), 51.48, 0);
    expect(g.polar).toBeNull();
    expect(g.rise).not.toBeNull();
    expect(g.set).not.toBeNull();
  });
});
