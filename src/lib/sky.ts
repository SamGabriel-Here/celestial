/* =============================================================================
 * sky.ts — the heart of the redesign.
 *
 * Maps an OpenWeather condition code plus the city's local hour onto a sky:
 * a vertical gradient, a light source, and the particle layers drawn over it.
 * Everything visual downstream (canvas, chrome, contrast) reads from here.
 * ========================================================================== */

import { zonedHour } from './format';

export type SkyPhase = 'night' | 'dawn' | 'morning' | 'day' | 'dusk';
export type Precip = 'none' | 'drizzle' | 'rain' | 'snow';

export interface Sky {
  phase: SkyPhase;
  /** Top-to-bottom gradient stops. */
  gradient: [string, string, string];
  /** Colour of the sun/moon glow and its position as viewport fractions. */
  glow: string;
  glowAt: [number, number];
  /** Chrome that reads well on this sky. */
  scheme: 'light' | 'dark';
  stars: number;
  clouds: number;
  cloudTone: string;
  precip: Precip;
  precipRate: number;
  lightning: boolean;
  fog: number;
  isNight: boolean;
}

/** Local hour → phase. Kept coarse; the sun's real position needs sunrise data. */
function phaseFor(hour: number, isNight: boolean): SkyPhase {
  if (isNight) return 'night';
  if (hour < 7) return 'dawn';
  if (hour < 11) return 'morning';
  if (hour < 17) return 'day';
  return 'dusk';
}

const PALETTE: Record<SkyPhase, { gradient: [string, string, string]; glow: string; scheme: 'light' | 'dark' }> = {
  night:   { gradient: ['#050914', '#0a1430', '#132247'], glow: '#9fb6e8', scheme: 'dark' },
  dawn:    { gradient: ['#1a2350', '#7a5580', '#e39a6b'], glow: '#ffca8a', scheme: 'dark' },
  morning: { gradient: ['#1d6fc4', '#54a6e4', '#b9dcf5'], glow: '#fff0c2', scheme: 'light' },
  day:     { gradient: ['#0e63b8', '#3f95dc', '#a9d4f2'], glow: '#fff6d8', scheme: 'light' },
  dusk:    { gradient: ['#16224e', '#8a4f74', '#e5a06a'], glow: '#ffbd77', scheme: 'dark' },
};

/** Overcast skies wash toward grey and always read as a light scheme by day. */
function greyed(gradient: [string, string, string], amount: number): [string, string, string] {
  return gradient.map((hex) => mixHex(hex, '#8892a0', amount)) as [string, string, string];
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i]! - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function parseHex(hex: string): number[] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/**
 * `code` is an OpenWeather icon code such as "10d". Its trailing d/n is the
 * authoritative day/night flag — more reliable than guessing from the hour,
 * because it already accounts for latitude and season.
 */
export function readSky(code: string, unixSeconds: number, tzOffset: number): Sky {
  const group = code.slice(0, 2);
  const isNight = code.endsWith('n');
  const hour = zonedHour(unixSeconds, tzOffset);
  const phase = phaseFor(hour, isNight);
  const base = PALETTE[phase];

  const overcast = group === '04' ? 0.55 : group === '03' ? 0.3 : group === '02' ? 0.12 : 0;
  const stormy = group === '09' || group === '10' || group === '11';
  const snowy = group === '13';
  const misty = group === '50';

  let gradient = base.gradient;
  let scheme = base.scheme;

  if (overcast) gradient = greyed(gradient, overcast);
  if (stormy) {
    // Deep enough that light chrome text keeps its contrast: a half-grey wash
    // left the lower sky around mid-grey, which the dimmer type disappeared into.
    gradient = greyed(gradient, 0.5).map((c) => mixHex(c, '#1b2331', 0.62)) as [string, string, string];
    scheme = 'dark';
  }
  if (snowy) {
    gradient = greyed(gradient, 0.45).map((c) => mixHex(c, '#cfd9e6', 0.3)) as [string, string, string];
    scheme = isNight ? 'dark' : 'light';
  }
  if (misty) gradient = greyed(gradient, 0.5);

  const precip: Precip = snowy
    ? 'snow'
    : group === '09'
      ? 'drizzle'
      : group === '10' || group === '11'
        ? 'rain'
        : 'none';

  return {
    phase,
    gradient,
    glow: base.glow,
    glowAt: isNight ? [0.78, 0.16] : [0.22, 0.14],
    scheme,
    stars: isNight ? (overcast > 0.4 || stormy ? 40 : 220) : 0,
    clouds: stormy ? 9 : snowy ? 7 : group === '04' ? 8 : group === '03' ? 5 : group === '02' ? 3 : 0,
    cloudTone: stormy ? '#39414f' : isNight ? '#1d2740' : overcast > 0.4 ? '#c3ccd8' : '#ffffff',
    precip,
    precipRate: group === '11' ? 1 : group === '10' ? 0.75 : group === '09' ? 0.4 : snowy ? 0.5 : 0,
    lightning: group === '11',
    fog: misty ? 0.55 : 0,
    isNight,
  };
}

/** A neutral sky for the states that render before any weather has loaded. */
export const IDLE_SKY: Sky = readSky('01n', 0, 0);
