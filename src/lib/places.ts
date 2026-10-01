import type { Place } from './types';
import type { Unit } from './units';

export interface Settings {
  v: 1;
  unit: Unit;
  last?: Place;
  saved: Place[];
}

const KEY = 'celestial:v1';
const defaults = (): Settings => ({ v: 1, unit: 'c', saved: [] });
const local = (): Storage | undefined => (typeof localStorage === 'undefined' ? undefined : localStorage);

/** Settings live only on this device; anything unreadable falls back to defaults. */
export function loadSettings(storage: Storage | undefined = local()): Settings {
  try {
    const s = JSON.parse(storage?.getItem(KEY) ?? 'null') as Settings | null;
    if (s?.v !== 1 || (s.unit !== 'c' && s.unit !== 'f') || !Array.isArray(s.saved)) return defaults();
    return s;
  } catch {
    return defaults();
  }
}

export function saveSettings(s: Settings, storage: Storage | undefined = local()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or blocked storage: settings last for this visit only.
  }
}

export function toggleSaved(s: Settings, p: Place): Settings {
  const saved = s.saved.some((x) => x.id === p.id) ? s.saved.filter((x) => x.id !== p.id) : [...s.saved, p];
  return { ...s, saved };
}
