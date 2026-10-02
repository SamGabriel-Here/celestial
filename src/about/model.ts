// The landing page's two small decisions: whose sky to show, and which moment the scroll has reached.

// Older zone names browsers still report, and zones since merged into a neighbour, by the city now on the map.
const ALIAS: Record<string, string> = {
  Calcutta: 'Kolkata', Saigon: 'Ho Chi Minh', Kiev: 'Kyiv', Rangoon: 'Yangon', Katmandu: 'Kathmandu', Asmera: 'Asmara',
  Godthab: 'Nuuk', Faeroe: 'Faroe', Ponape: 'Pohnpei', Truk: 'Chuuk', Enderbury: 'Kanton', 'Coral Harbour': 'Atikokan',
  'Santa Isabel': 'Tijuana', Nipigon: 'Toronto', 'Thunder Bay': 'Toronto', 'Rainy River': 'Winnipeg', Pangnirtung: 'Iqaluit',
  Yellowknife: 'Edmonton', Choibalsan: 'Ulaanbaatar', Currie: 'Hobart', Uzhgorod: 'Kyiv', Zaporozhye: 'Kyiv', Johnston: 'Honolulu',
};

/** The city a time zone is named after ("America/New_York" → "New York"); none for "UTC" or "Etc/…". */
export function zoneCity(zone: string | undefined): string | undefined {
  if (!zone || !zone.includes('/') || zone.startsWith('Etc/')) return undefined;
  const city = zone.slice(zone.lastIndexOf('/') + 1).replace(/_/g, ' ');
  return ALIAS[city] ?? city;
}

/** The wheel holds still for a breath at the start, and parks on its last hour for the end of the act. */
export const HOLD = 0.04;
const END = 0.92;
const SPAN = 23; // hours ahead on the last segment of the rim

// Dusk is the page's moment: from the sun 6° up to 12° below the horizon it gets this share of the turn
// (about 27% of the whole act once the opening hold and the parked end are counted), centred this far
// through the act. Everything before dusk and everything after share what is left.
const DUSK_SHARE = 0.27 / (END - HOLD);
const DUSK_MID = (0.55 - HOLD) / (END - HOLD);
const SMOOTH = 30; // minutes either side over which the pace eases between stretches

/**
 * Scroll as sun angle rather than clock time: maps act progress p (0..1) to hours ahead of now.
 * `altAt(h)` is the sun's altitude in degrees h hours from now. Dusk is slowed so it fills about a quarter
 * of the turn and lands mid-act; the hours on either side speed up to make room (after dark, that is the
 * night). Without a dusk in the window (polar day or night) it falls back to plain clock time.
 */
export function skyTime(altAt: (h: number) => number): (p: number) => number {
  const N = SPAN * 60;
  const alt = Array.from({ length: N + 1 }, (_, i) => altAt(i / 60));
  let s0 = -1, s1 = N;
  for (let i = 1; i <= N; i++) {
    const inDusk = alt[i]! <= 6 && alt[i]! >= -12 && alt[i]! < alt[i - 1]!;
    if (inDusk && s0 < 0) s0 = i;
    else if (!inDusk && s0 >= 0) { s1 = i; break; }
  }
  const at = (p: number) => Math.min(1, Math.max(0, (p - HOLD) / (END - HOLD)));
  if (s0 < 0) return (p) => at(p) * SPAN;

  // Pace per minute in each stretch: dusk gets its share; before and after it split the rest so dusk
  // lands at DUSK_MID, but neither may run slower than dusk itself.
  const total = 1 / DUSK_SHARE, duskRate = 1 / (s1 - s0);
  const before = s0 ? Math.min(duskRate, (DUSK_MID * total - 0.5) / s0) : 0;
  const after = N - s1 ? Math.min(duskRate, ((1 - DUSK_MID) * total - 0.5) / (N - s1)) : 0;
  let pace = Array.from({ length: N }, (_, i) => (i < s0 ? before : i < s1 ? duskRate : after));
  for (let pass = 0; pass < 2; pass++) { // two box blurs ease the changes of pace in and out
    pace = pace.map((_, i) => {
      let sum = 0, n = 0;
      for (let j = Math.max(0, i - SMOOTH); j <= Math.min(N - 1, i + SMOOTH); j++) { sum += pace[j]!; n++; }
      return sum / n;
    });
  }
  const cum = [0];
  for (const v of pace) cum.push(cum[cum.length - 1]! + v);
  const whole = cum[N]!;
  return (p) => {
    const target = at(p) * whole;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid]! <= target) lo = mid; else hi = mid; }
    const step = cum[hi]! - cum[lo]!;
    return (lo + (step ? (target - cum[lo]!) / step : 0)) / 60;
  };
}

/** Hours from now until the sun next sinks past 6° below the horizon (civil nightfall), or null if not within a day. */
export function nightfall(altAt: (h: number) => number, span = SPAN): number | null {
  let prev = altAt(0);
  for (let m = 2; m <= span * 60; m += 2) {
    const a = altAt(m / 60);
    if (prev > -6 && a <= -6) return m / 60;
    prev = a;
  }
  return null;
}
