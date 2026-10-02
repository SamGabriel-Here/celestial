import { useData } from '../app/data';
import { Dial, type Segment } from '../dial/Dial';
import { SkyWindow } from '../dial/SkyWindow';
import { moonPhase, phaseName, sunPosition } from '../lib/astro';
import { skyColour } from '../lib/sky';
import { offsetAt, zonedIso } from '../lib/units';

const DAY = 864e5;
const CYCLE = 30; // days on the rim: one lunar month

/** The sky now, and a rim of the coming lunar month: spoke length is how much of the moon is lit. */
export function AirDial() {
  const { place, forecast, url, setUrl, now } = useData();
  if (!place || !forecast) return null;
  const tz = forecast.timezone;
  const i = Math.min(url.t, CYCLE - 1);
  // Day 0 is now; later days show that night at 22:00 local.
  const nightOf = (k: number) => {
    const local = zonedIso(now + k * DAY, tz).slice(0, 10);
    const guess = Date.parse(`${local}T22:00Z`);
    return guess - offsetAt(guess, tz) * 1000; // 22:00 on the place's own clock
  };
  const days = Array.from({ length: CYCLE }, (_, k) => {
    const ms = k ? nightOf(k) : now;
    return { ms, ...moonPhase(ms), iso: zonedIso(ms, tz) };
  });
  const segments: Segment[] = days.map((d, k) => {
    const prev = k ? days[k - 1]!.phase : d.phase;
    const turn = k > 0 && ((prev < 0.5 && d.phase >= 0.5) || d.phase < prev - 0.5); // full or new moon falls in this day
    return { key: d.iso.slice(0, 10), top: String(Number(d.iso.slice(8, 10))), bottom: '', spoke: Math.max(0.02, d.lit), spokeAlpha: 1, tone: 'moon', mark: k === 0 || turn };
  });
  const d = days[i]!;
  const hour = forecast.hours.find((h) => h.ms <= d.ms && h.ms + 3600e3 > d.ms);
  return (
    <>
      <Dial segments={segments} index={i} onIndex={(t) => setUrl({ t })} label="Turn the wheel through the coming lunar month"
        glow={skyColour(sunPosition(d.ms, place.lat, place.lon).alt, hour ? Math.max(hour.low, hour.mid, hour.high) : 0).horizon}
        valueText={`${d.iso.slice(5, 10)}: ${phaseName(d.phase)}, ${Math.round(d.lit * 100)}% lit`}>
        <SkyWindow ms={d.ms} lat={place.lat} lon={place.lon} low={hour?.low ?? 0} mid={hour?.mid ?? 0} high={hour?.high ?? 0} mm={hour?.mm ?? 0}
          label={`The sky over ${place.name}${i ? ' that night' : ' now'}: ${phaseName(d.phase).toLowerCase()}, ${Math.round(d.lit * 100)}% lit`} />
      </Dial>
      <p className="dial-hint">{i ? `${phaseName(d.phase)}, ${Math.round(d.lit * 100)}% lit, that night at 22:00` : 'The sky now. Turn the wheel through the coming lunar month'}</p>
    </>
  );
}
