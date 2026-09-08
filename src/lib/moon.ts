/* =============================================================================
 * moon.ts — lunar phase from the clock alone.
 *
 * OpenWeather's free tier carries no moon data, but phase needs none: it is a
 * function of time. This is the standard mean-synodic approximation, which
 * drifts by a few hours at worst — far below the resolution of "waxing gibbous,
 * 81% lit", which is all we render.
 * ========================================================================== */

/** Mean synodic month: new moon to new moon. */
const SYNODIC_DAYS = 29.530588853;
const DAY_MS = 86_400_000;

/** A known new moon: 2000-01-06 18:14 UTC. */
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

export type MoonName =
  | 'New moon' | 'Waxing crescent' | 'First quarter' | 'Waxing gibbous'
  | 'Full moon' | 'Waning gibbous' | 'Last quarter' | 'Waning crescent';

export interface Moon {
  /** 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
  phase: number;
  /** Days since the last new moon. */
  age: number;
  /** Lit fraction of the disc, 0–1. */
  illumination: number;
  waxing: boolean;
  name: MoonName;
  /** Days until the next full moon and the next new moon. */
  daysToFull: number;
  daysToNew: number;
}

const wrap = (value: number, span: number) => ((value % span) + span) % span;

export function moonAt(at: number = Date.now()): Moon {
  const age = wrap((at - REFERENCE_NEW_MOON) / DAY_MS, SYNODIC_DAYS);
  const phase = age / SYNODIC_DAYS;
  return {
    phase,
    age,
    illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2,
    waxing: phase < 0.5,
    name: nameFor(phase),
    daysToFull: wrap(SYNODIC_DAYS / 2 - age, SYNODIC_DAYS),
    daysToNew: wrap(SYNODIC_DAYS - age, SYNODIC_DAYS),
  };
}

/** The four exact phases get a narrow window; everything else is a crescent or gibbous. */
function nameFor(phase: number): MoonName {
  const near = (target: number) => Math.abs(wrap(phase - target + 0.5, 1) - 0.5) < 0.02;
  if (near(0)) return 'New moon';
  if (near(0.25)) return 'First quarter';
  if (near(0.5)) return 'Full moon';
  if (near(0.75)) return 'Last quarter';
  if (phase < 0.25) return 'Waxing crescent';
  if (phase < 0.5) return 'Waxing gibbous';
  if (phase < 0.75) return 'Waning gibbous';
  return 'Waning crescent';
}

/**
 * Where to put the shadow disc to carve this phase, as a fraction of the moon's
 * radius. Overlaying a same-sized circle offset by this much leaves exactly the
 * lit lune: 0 covers the disc completely (new), 2 clears it entirely (full).
 * Positive means the shadow sits to the left, so the lit limb faces right.
 */
export function shadowOffset(moon: Moon): number {
  const distance = 2 * moon.illumination;
  return moon.waxing ? -distance : distance;
}

/** Fixed maria, as fractions of the radius, so the face never shimmers. */
export const MARIA: [x: number, y: number, r: number, alpha: number][] = [
  [-0.30, -0.26, 0.22, 0.10],
  [0.16, -0.38, 0.14, 0.07],
  [0.31, 0.22, 0.24, 0.09],
  [-0.20, 0.36, 0.16, 0.07],
  [0.00, 0.02, 0.11, 0.06],
  [-0.44, 0.08, 0.10, 0.05],
];
