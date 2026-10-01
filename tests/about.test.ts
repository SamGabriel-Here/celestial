import { describe, expect, it } from 'vitest';
import { hoursAt, zoneCity } from '../src/about/model';

describe('zoneCity', () => {
  it('reads the city a zone is named after', () => {
    expect(zoneCity('America/New_York')).toBe('New York');
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
    expect(zoneCity('Asia/Calcutta')).toBe('Kolkata');
  });
  it('has no city for UTC-style zones', () => {
    expect(zoneCity('UTC')).toBeUndefined();
    expect(zoneCity('Etc/GMT+5')).toBeUndefined();
    expect(zoneCity(undefined)).toBeUndefined();
  });
});

describe('hoursAt', () => {
  it('holds still through the opening, then turns to the last hour', () => {
    expect(hoursAt(0)).toBe(0);
    expect(hoursAt(0.12)).toBe(0);
    expect(hoursAt(0.52)).toBeCloseTo(11.5);
    expect(hoursAt(0.92)).toBe(23);
    expect(hoursAt(1)).toBe(23);
  });
});
