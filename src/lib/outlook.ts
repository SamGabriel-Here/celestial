import type { Forecast, Hour } from './types';
import { capitalise, clockLabel, weatherWords, zonedIso } from './units';

const HOUR = 3600e3;
const QUARTER = 15 * 60e3;
const FRESH = 30 * 60e3; // an observation older than this is not "now"
const isWet = (h: Hour) => h.mm >= 0.1 || (h.pop ?? 0) >= 50;
const rainWords = (h: Hour) => (h.code >= 51 ? weatherWords(h.code) : 'rain likely');

/** The one-line answer to "when does it rain?", in the place's local time. */
export function outlook(f: Forecast, nowMs: number): string {
  const ahead = f.hours.filter((h) => h.ms + HOUR > nowMs && h.ms < nowMs + 24 * HOUR);
  const later = ahead.filter((h) => h.ms > nowMs);
  const today = zonedIso(nowMs, f.timezone).slice(0, 10);
  const quarters = f.quarters.filter((q) => q.ms + QUARTER > nowMs);
  const fresh = nowMs - f.asOfMs < FRESH;
  const when = (h: Hour) => (h.iso.slice(0, 10) > today ? `${clockLabel(h.iso)} tomorrow` : clockLabel(h.iso));

  const nowQuarter = quarters[0] && quarters[0].ms <= nowMs ? quarters[0] : undefined;
  if ((fresh && f.current.mm > 0) || (nowQuarter?.mm ?? 0) > 0) {
    const dry = later.find((h) => !isWet(h));
    return dry ? `Rain now, easing by ${when(dry)}` : 'Rain now, and through the next 24 hours';
  }

  const quarter = quarters.find((q) => q.mm > 0 && q.ms < nowMs + 2 * HOUR);
  if (quarter) return `Rain from ${clockLabel(quarter.iso)}`;

  const wet = ahead.find(isWet);
  if (!wet) return 'Dry for the next 24 hours';
  if (wet.ms <= nowMs) return `${capitalise(wet.code >= 51 ? weatherWords(wet.code) : 'rain')} likely within the hour`;
  return `Dry until ${when(wet)}, then ${rainWords(wet)}`;
}
