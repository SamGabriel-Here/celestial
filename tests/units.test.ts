import { describe, expect, it } from 'vitest';
import { clockLabel, compass, fmtTemp, fmtWind, offsetAt, toUnit, weekday, zonedIso } from '../src/lib/units';

describe('units', () => {
  it('converts celsius to fahrenheit', () => {
    expect(toUnit(0, 'f')).toBe(32);
    expect(toUnit(-40, 'f')).toBe(-40);
    expect(toUnit(21, 'c')).toBe(21);
  });
  it('formats temperatures rounded, never as -0', () => {
    expect(fmtTemp(20.6, 'c')).toBe('21°');
    expect(fmtTemp(-0.4, 'c')).toBe('0°');
    expect(fmtTemp(0, 'f')).toBe('32°');
  });
  it('names compass points, wrapping at north', () => {
    expect(compass(0)).toBe('N');
    expect(compass(359)).toBe('N');
    expect(compass(135)).toBe('SE');
  });
  it('formats wind', () => expect(fmtWind(11.6)).toBe('12 km/h'));
  it('reads the clock and weekday straight from the local ISO string', () => {
    expect(clockLabel('2026-10-01T07:00')).toBe('07:00');
    expect(weekday('2026-10-01T07:00')).toBe('Thu');
  });
  it('gives a place’s true wall-clock time, across a daylight-saving change', () => {
    expect(zonedIso(Date.UTC(2026, 9, 1, 1, 7), 'Asia/Kathmandu')).toBe('2026-10-01T06:52');
    expect(zonedIso(Date.UTC(2026, 9, 1, 1, 7), 'Pacific/Honolulu')).toBe('2026-09-30T15:07');
    expect(zonedIso(Date.UTC(2026, 9, 3, 15), 'Australia/Sydney')).toBe('2026-10-04T01:00'); // AEST
    expect(zonedIso(Date.UTC(2026, 9, 3, 16), 'Australia/Sydney')).toBe('2026-10-04T03:00'); // AEDT: 02:00 never happens
    expect(zonedIso(Date.UTC(2026, 9, 1, 0, 0), 'Asia/Tokyo')).toBe('2026-10-01T09:00');
  });
  it('knows the offset in force at an instant', () => {
    expect(offsetAt(Date.UTC(2026, 9, 3, 15), 'Australia/Sydney')).toBe(36000);
    expect(offsetAt(Date.UTC(2026, 9, 3, 16), 'Australia/Sydney')).toBe(39600);
  });
});
