import { expect, it } from 'vitest';
import { euBand, usBand } from '../src/lib/air';

it('names European AQI bands', () => {
  expect(euBand(15)).toBe('Good');
  expect(euBand(40)).toBe('Fair');
  expect(euBand(55)).toBe('Moderate');
  expect(euBand(130)).toBe('Extremely poor');
  expect(euBand(null)).toBe('Unknown');
});
it('names US AQI bands', () => {
  expect(usBand(50)).toBe('Good');
  expect(usBand(65)).toBe('Moderate');
  expect(usBand(120)).toBe('Unhealthy for sensitive groups');
  expect(usBand(350)).toBe('Hazardous');
});
