import { describe, expect, it } from 'vitest';
import { forecastUrl, parseAir, parseBatchCurrent, parseForecast, parseGeocode } from '../src/lib/openmeteo';
import type { Place } from '../src/lib/types';
import tokyo from './fixtures/tokyo.json';
import honolulu from './fixtures/honolulu.json';
import kathmandu from './fixtures/kathmandu.json';
import springfield from './fixtures/geocode-springfield.json';
import airTokyo from './fixtures/air-tokyo.json';
import batch from './fixtures/batch-current.json';

const place: Place = { id: '35.68,139.69', name: 'Tokyo', country: 'JP', lat: 35.68, lon: 139.69 };

describe('parseForecast', () => {
  it('keeps the API’s own local wall-clock string on every hour', () => {
    const f = parseForecast(tokyo, place);
    expect(f.hours[0]!.iso).toBe(tokyo.hourly.time[0]);
    expect(f.hours).toHaveLength(384);
    expect(f.days).toHaveLength(16);
    expect(f.quarters).toHaveLength(8);
  });
  it('turns local time into true UTC instants with the place’s offset', () => {
    const f = parseForecast(tokyo, place);
    expect(f.offsetSec).toBe(32400);
    expect(f.hours[0]!.ms).toBe(Date.parse(tokyo.hourly.time[0] + 'Z') - 32400e3);
  });
  it('handles half-hour-ish and negative offsets', () => {
    expect(parseForecast(kathmandu, place).offsetSec).toBe(20700);
    expect(parseForecast(honolulu, place).offsetSec).toBe(-36000);
  });
  it('keeps missing values as null instead of zero', () => {
    const j = structuredClone(tokyo) as unknown as { hourly: Record<string, (number | null)[]> };
    j.hourly.precipitation_probability![5] = null;
    j.hourly.freezing_level_height![5] = null;
    const h = parseForecast(j, place).hours[5]!;
    expect(h.pop).toBeNull();
    expect(h.freeze).toBeNull();
  });
});

describe('parseGeocode', () => {
  it('returns every candidate with its region so ambiguous names can be told apart', () => {
    const r = parseGeocode(springfield);
    expect(r.length).toBeGreaterThan(1);
    expect(r[0]!.region).toBe('Missouri');
    expect(r[0]!.country).toBe('US');
    expect(r[0]!.id).toBe(`${r[0]!.lat.toFixed(2)},${r[0]!.lon.toFixed(2)}`);
  });
  it('returns nothing for no results', () => expect(parseGeocode({})).toEqual([]));
});

describe('parseAir and parseBatchCurrent', () => {
  it('reads both AQI scales and the pollutants', () => {
    const a = parseAir(airTokyo);
    expect(a.euAqi).toBe(airTokyo.current.european_aqi);
    expect(a.usAqi).toBe(airTokyo.current.us_aqi);
    expect(a.pm25).toBe(airTokyo.current.pm2_5);
  });
  it('reads one current reading per place, also for a single place', () => {
    expect(parseBatchCurrent(batch)).toHaveLength(2);
    expect(parseBatchCurrent(batch[0])).toHaveLength(1);
  });
});

it('asks for the hourly fields the section needs', () => {
  const u = new URL(forecastUrl(place));
  for (const k of ['cloud_cover_low', 'freezing_level_height', 'wind_gusts_10m', 'uv_index']) expect(u.searchParams.get('hourly')).toContain(k);
  expect(u.searchParams.get('forecast_days')).toBe('16');
  expect(u.searchParams.get('timezone')).toBe('auto');
});
