// Positions of the sun, moon and bright stars. Formulas after SunCalc (V. Agafonkin, BSD).
// Angles in degrees; azimuth measured from north, clockwise.

export type Position = { alt: number; az: number };
export type Star = readonly [name: string, raHours: number, decDeg: number, mag: number];

const RAD = Math.PI / 180;
const OBLIQUITY = RAD * 23.4397;
const toDays = (ms: number) => ms / 864e5 - 0.5 + 2440588 - 2451545;
const rightAscension = (l: number, b: number) =>
  Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l));
const declination = (l: number, b: number) =>
  Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l));
const sidereal = (d: number, lw: number) => RAD * (280.16 + 360.9856235 * d) - lw;

function sunCoords(d: number) {
  const m = RAD * (357.5291 + 0.98560028 * d);
  const c = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  const l = m + c + RAD * 102.9372 + Math.PI;
  return { ra: rightAscension(l, 0), dec: declination(l, 0) };
}

function moonCoords(d: number) {
  const l0 = RAD * (218.316 + 13.176396 * d);
  const m = RAD * (134.963 + 13.064993 * d);
  const f = RAD * (93.272 + 13.22935 * d);
  const l = l0 + RAD * 6.289 * Math.sin(m);
  const b = RAD * 5.128 * Math.sin(f);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist: 385001 - 20905 * Math.cos(m) };
}

function horizontal(ra: number, dec: number, ms: number, lat: number, lon: number): Position {
  const h = sidereal(toDays(ms), RAD * -lon) - ra;
  const phi = RAD * lat;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h));
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { alt: alt / RAD, az: (az / RAD + 180) % 360 };
}

export function sunPosition(ms: number, lat: number, lon: number): Position {
  const c = sunCoords(toDays(ms));
  return horizontal(c.ra, c.dec, ms, lat, lon);
}

export function moonPosition(ms: number, lat: number, lon: number): Position {
  const c = moonCoords(toDays(ms));
  return horizontal(c.ra, c.dec, ms, lat, lon);
}

/** lit: illuminated fraction 0..1. phase: 0 new → 0.5 full → 1 new. */
export function moonPhase(ms: number): { lit: number; phase: number } {
  const d = toDays(ms);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const sunDist = 149598000;
  const phi = Math.acos(
    Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra),
  );
  const inc = Math.atan2(sunDist * Math.sin(phi), m.dist - sunDist * Math.cos(phi));
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
  );
  return { lit: (1 + Math.cos(inc)) / 2, phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI };
}

const PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous',
  'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
export const phaseName = (phase: number): string => PHASES[Math.round(phase * 8) % 8] as string;

/** Rise/set within the 24 h starting at `ms`; `polar` when the sun never crosses the horizon. */
export function sunEvents(ms: number, lat: number, lon: number): { rise: number | null; set: number | null; polar: 'day' | 'night' | null } {
  const HORIZON = -0.833; // refraction + solar radius
  const step = 5 * 60e3;
  let rise: number | null = null;
  let set: number | null = null;
  let above = sunPosition(ms, lat, lon).alt > HORIZON;
  let everAbove = above;
  for (let t = ms + step; t <= ms + 864e5; t += step) {
    const alt = sunPosition(t, lat, lon).alt;
    const nowAbove = alt > HORIZON;
    if (nowAbove && !above && rise === null) rise = t;
    if (!nowAbove && above && set === null) set = t;
    everAbove ||= nowAbove;
    above = nowAbove;
  }
  const polar = rise === null && set === null ? (everAbove ? 'day' : 'night') : null;
  return { rise, set, polar };
}

// The brightest stars (J2000): name, right ascension in hours, declination in degrees, magnitude.
export const STARS: readonly Star[] = [
  ['Sirius', 6.752, -16.716, -1.46], ['Canopus', 6.399, -52.696, -0.74], ['Arcturus', 14.261, 19.182, -0.05],
  ['Vega', 18.616, 38.784, 0.03], ['Capella', 5.278, 45.998, 0.08], ['Rigel', 5.242, -8.202, 0.13],
  ['Procyon', 7.655, 5.225, 0.34], ['Betelgeuse', 5.919, 7.407, 0.5], ['Achernar', 1.629, -57.237, 0.46],
  ['Hadar', 14.064, -60.373, 0.61], ['Altair', 19.846, 8.868, 0.76], ['Acrux', 12.443, -63.099, 0.77],
  ['Aldebaran', 4.599, 16.509, 0.86], ['Antares', 16.49, -26.432, 0.96], ['Spica', 13.42, -11.161, 0.97],
  ['Pollux', 7.755, 28.026, 1.14], ['Fomalhaut', 22.961, -29.622, 1.16], ['Deneb', 20.69, 45.28, 1.25],
  ['Mimosa', 12.795, -59.689, 1.25], ['Regulus', 10.14, 11.967, 1.35], ['Adhara', 6.977, -28.972, 1.5],
  ['Castor', 7.577, 31.888, 1.58], ['Shaula', 17.56, -37.104, 1.62], ['Gacrux', 12.519, -57.113, 1.64],
  ['Bellatrix', 5.419, 6.35, 1.64], ['Elnath', 5.438, 28.608, 1.65], ['Alnilam', 5.604, -1.202, 1.69],
  ['Alnitak', 5.679, -1.943, 1.77], ['Mintaka', 5.533, -0.299, 2.23], ['Alioth', 12.9, 55.96, 1.77],
  ['Dubhe', 11.062, 61.751, 1.79], ['Mirfak', 3.405, 49.861, 1.79], ['Alkaid', 13.792, 49.313, 1.86],
  ['Mizar', 13.399, 54.925, 2.04], ['Merak', 11.031, 56.382, 2.37], ['Phecda', 11.897, 53.695, 2.44],
  ['Megrez', 12.257, 57.033, 3.31], ['Polaris', 2.53, 89.264, 1.98], ['Kochab', 14.845, 74.156, 2.08],
  ['Saiph', 5.796, -9.67, 2.09], ['Schedar', 0.675, 56.537, 2.24], ['Caph', 0.153, 59.15, 2.28],
  ['Ruchbah', 1.43, 60.235, 2.68], ['Navi', 0.945, 60.717, 2.47], ['Segin', 1.906, 63.67, 3.35],
];

export const starPosition = (star: Star, ms: number, lat: number, lon: number): Position =>
  horizontal(star[1] * 15 * RAD, star[2] * RAD, ms, lat, lon);
