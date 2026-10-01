import type { Forecast, Hour } from './types';
import { capitalise, clockLabel, weatherWords } from './units';

const HOUR = 3600e3;
const isWet = (h: Hour) => h.mm >= 0.1 || (h.pop ?? 0) >= 50;
const rainWords = (h: Hour) => (h.code >= 51 ? weatherWords(h.code) : 'rain likely');

/** The one-line answer to "when does it rain?", in the place's local time. */
export function outlook(f: Forecast, nowMs: number): string {
  const ahead = f.hours.filter((h) => h.ms + HOUR > nowMs && h.ms < nowMs + 24 * HOUR);
  const later = ahead.filter((h) => h.ms > nowMs);

  if (f.current.mm > 0 || (f.quarters[0]?.mm ?? 0) > 0) {
    const dry = later.find((h) => !isWet(h));
    return dry ? `Rain now, easing by ${clockLabel(dry.iso)}` : 'Rain now, and through the next 24 hours';
  }

  const quarter = f.quarters.find((q) => q.mm > 0 && q.ms < nowMs + 2 * HOUR);
  if (quarter) return `Rain from ${clockLabel(quarter.iso)}`;

  const wet = ahead.find(isWet);
  if (!wet) return 'Dry for the next 24 hours';
  if (wet.ms <= nowMs) return `${capitalise(wet.code >= 51 ? weatherWords(wet.code) : 'rain')} likely within the hour`;
  const today = new Date(nowMs + f.offsetSec * 1000).toISOString().slice(0, 10);
  const when = wet.iso.slice(0, 10) > today ? `${clockLabel(wet.iso)} tomorrow` : clockLabel(wet.iso);
  return `Dry until ${when}, then ${rainWords(wet)}`;
}
