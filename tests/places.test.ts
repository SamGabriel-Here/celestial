import { expect, it } from 'vitest';
import { loadSettings, saveSettings, toggleSaved } from '../src/lib/places';
import type { Place } from '../src/lib/types';

function memory(seed: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k),
    clear: () => m.clear(), key: () => null, get length() { return m.size; } };
}
const tokyo: Place = { id: '35.68,139.69', name: 'Tokyo', country: 'JP', lat: 35.68, lon: 139.69 };
const DEFAULTS = { v: 1, unit: 'c', saved: [] };

it('starts from defaults', () => expect(loadSettings(memory())).toEqual(DEFAULTS));
it('survives corrupt JSON and a different version', () => {
  expect(loadSettings(memory({ 'celestial:v1': '{nope' }))).toEqual(DEFAULTS);
  expect(loadSettings(memory({ 'celestial:v1': '{"v":2,"unit":"f","saved":[]}' }))).toEqual(DEFAULTS);
});
it('survives storage that throws (private mode, blocked)', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } } as unknown as Storage;
  expect(loadSettings(broken)).toEqual(DEFAULTS);
  expect(() => saveSettings({ v: 1, unit: 'f', saved: [] }, broken)).not.toThrow();
});
it('saves and loads', () => {
  const s = memory();
  saveSettings({ v: 1, unit: 'f', last: tokyo, saved: [tokyo] }, s);
  expect(loadSettings(s)).toEqual({ v: 1, unit: 'f', last: tokyo, saved: [tokyo] });
});
it('toggles a saved place without duplicates', () => {
  const once = toggleSaved({ v: 1, unit: 'c', saved: [] }, tokyo);
  expect(once.saved).toEqual([tokyo]);
  expect(toggleSaved(once, { ...tokyo }).saved).toEqual([]);
});
