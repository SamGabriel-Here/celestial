import { describe, expect, it } from 'vitest';
import { dayColumns, hourColumns } from '../src/lib/columns';
import { parseForecast } from '../src/lib/openmeteo';
import { clockLabel } from '../src/lib/units';
import tokyo from './fixtures/tokyo.json';

const f = parseForecast(tokyo, { id: '35.68,139.69', name: 'Tokyo', country: 'JP', lat: 35.68, lon: 139.69 });
const now = f.hours[10]!.ms + 20 * 60e3; // 20 minutes into the 11th hour

describe('hourColumns', () => {
  const cols = hourColumns(f, now);
  it('covers 36 hours starting at the current local hour', () => {
    expect(cols).toHaveLength(36);
    expect(cols[0]!.label).toBe(clockLabel(f.hours[10]!.iso));
    expect(cols[0]!.iso).toBe(f.hours[10]!.iso);
  });
  it('labels the day at local midnight', () => {
    const midnight = cols.find((c) => c.iso.endsWith('T00:00'))!;
    expect(midnight.dayLabel).toBe('Fri');
    expect(cols[0]!.dayLabel).toBeUndefined();
  });
  it('keeps an unknown chance of rain unknown', () => {
    const j = structuredClone(tokyo) as unknown as { hourly: Record<string, (number | null)[]> };
    j.hourly.precipitation_probability![12] = null;
    const g = parseForecast(j, f.place);
    expect(hourColumns(g, now)[2]!.pop).toBeNull();
  });
  it('computes the sun for each hour', () => {
    expect(cols.some((c) => c.sunAlt > 0)).toBe(true);
    expect(cols.some((c) => c.sunAlt < 0)).toBe(true);
  });
});


describe('dayColumns', () => {
  const days = dayColumns(f);
  it('has one column per forecast day', () => expect(days).toHaveLength(16));
  it('averages each local date’s hourly cloud decks', () => {
    const first = tokyo.hourly.cloud_cover_low.slice(0, 24);
    expect(days[0]!.low).toBeCloseTo(first.reduce((a, b) => a + b, 0) / 24, 6);
  });
  it('carries the day’s range, rain and label', () => {
    expect(days[0]!.temp).toBe(f.days[0]!.max);
    expect(days[0]!.tempMin).toBe(f.days[0]!.min);
    expect(days[0]!.mm).toBe(f.days[0]!.mm);
    expect(days[0]!.label).toBe('Thu');
  });
  it('lights each day by its noon sun', () => expect(days.every((d) => d.sunAlt > 0)).toBe(true));
});
