import { describe, expect, it } from 'vitest';
import { clockLabel, compass, fmtTemp, fmtWind, localIso, toUnit, weekday } from '../src/lib/units';

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
  it('gives a place’s local wall-clock time from a UTC instant and its offset', () => {
    expect(localIso(Date.UTC(2026, 9, 1, 1, 7), 20700)).toBe('2026-10-01T06:52');   // Kathmandu +05:45
    expect(localIso(Date.UTC(2026, 9, 1, 1, 7), -36000)).toBe('2026-09-30T15:07');  // Honolulu −10:00
  });
});
