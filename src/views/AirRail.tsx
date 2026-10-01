import { useData } from '../app/data';
import { euBand, usBand } from '../lib/air';
import { moonPhase, nextPhase, phaseName, sunEvents } from '../lib/astro';
import { clockLabel } from '../lib/units';

const DAY = 864e5;

export function AirRail() {
  const { place, forecast, air, airFailed } = useData();
  if (!place || !forecast) return null;
  const today = forecast.days[0];
  const now = Date.now();
  const polar = sunEvents(now, place.lat, place.lon).polar;
  const ph = moonPhase(now);
  const days = (t: number) => Math.round((t - now) / DAY);
  const uvNow = forecast.hours.find((h) => h.ms <= now && h.ms + 3600e3 > now)?.uv;
  const hrs = today ? Math.floor(today.daylight / 3600) : 0;
  const mins = today ? Math.round((today.daylight % 3600) / 60) : 0;
  const ug = (v: number | null) => (v === null ? '—' : `${Math.round(v)} µg/m³`);

  return (
    <div className="rail-more">
      <section className="layers">
        <h2>Air quality</h2>
        {airFailed || !air ? <p className="quiet small">Air quality is unavailable right now.</p> : (
          <dl>
            <div><dt>European index <small>{euBand(air.euAqi)}</small></dt><dd className="mono">{air.euAqi ?? '—'}</dd></div>
            <div><dt>US index <small>{usBand(air.usAqi)}</small></dt><dd className="mono">{air.usAqi ?? '—'}</dd></div>
            <div><dt>Fine particles <small>PM2.5</small></dt><dd className="mono">{ug(air.pm25)}</dd></div>
            <div><dt>Coarse particles <small>PM10</small></dt><dd className="mono">{ug(air.pm10)}</dd></div>
            <div><dt>Ozone <small>O₃</small></dt><dd className="mono">{ug(air.o3)}</dd></div>
            <div><dt>Nitrogen dioxide <small>NO₂</small></dt><dd className="mono">{ug(air.no2)}</dd></div>
            <div><dt>Sulphur dioxide <small>SO₂</small></dt><dd className="mono">{ug(air.so2)}</dd></div>
            <div><dt>Carbon monoxide <small>CO</small></dt><dd className="mono">{ug(air.co)}</dd></div>
          </dl>
        )}
      </section>
      <section className="layers">
        <h2>Sun</h2>
        <dl>
          {polar ? (
            <div><dt>{polar === 'day' ? 'No sunset today' : 'No sunrise today'}</dt><dd className="mono">{polar === 'day' ? 'midnight sun' : 'polar night'}</dd></div>
          ) : (
            <>
              <div><dt>Sunrise</dt><dd className="mono">{today?.rise ? clockLabel(today.rise) : '—'}</dd></div>
              <div><dt>Sunset</dt><dd className="mono">{today?.set ? clockLabel(today.set) : '—'}</dd></div>
            </>
          )}
          <div><dt>Daylight</dt><dd className="mono">{hrs} h {mins} min</dd></div>
          <div><dt>UV now <small>max today {today?.uv != null ? Math.round(today.uv) : '—'}</small></dt><dd className="mono">{uvNow != null ? Math.round(uvNow) : '—'}</dd></div>
        </dl>
      </section>
      <section className="layers">
        <h2>Moon</h2>
        <dl>
          <div><dt>{phaseName(ph.phase)}</dt><dd className="mono">{Math.round(ph.lit * 100)}% lit</dd></div>
          <div><dt>Next full moon</dt><dd className="mono">in {days(nextPhase(now, 0.5))} days</dd></div>
          <div><dt>Next new moon</dt><dd className="mono">in {days(nextPhase(now, 0))} days</dd></div>
        </dl>
      </section>
    </div>
  );
}
