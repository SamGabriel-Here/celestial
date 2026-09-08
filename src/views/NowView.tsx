import { WeatherIcon } from '../components/icons';
import { Metric, SectionHeading, Stamp } from '../components/parts';
import { useStore } from '../app/store';
import { useRoute } from '../app/router';
import {
  compass, degreeLabel, formatFullDate, formatHour, formatTime, placeLabel,
  temp, tempShort, titleCase, visibility, wind,
} from '../lib/format';

/** Magnus–Tetens approximation; a more useful companion to raw humidity. */
function dewPoint(celsius: number, humidity: number): number | null {
  if (!Number.isFinite(celsius) || !Number.isFinite(humidity) || humidity <= 0) return null;
  const gamma = (17.62 * celsius) / (243.12 + celsius) + Math.log(humidity / 100);
  return (243.12 * gamma) / (17.62 - gamma);
}

const describeVisibility = (m: number | undefined) =>
  m === undefined ? '' : m >= 10000 ? 'Clear to the horizon'
    : m >= 4000 ? 'Slight haze' : m >= 1000 ? 'Reduced — take care' : 'Poor visibility';

const describeClouds = (p: number | undefined) =>
  p === undefined ? '' : p <= 10 ? 'Open sky' : p <= 40 ? 'Mostly clear'
    : p <= 75 ? 'Partly cloudy' : 'Overcast';

export function NowView() {
  const { weather, unit } = useStore();
  const { navigate } = useRoute();
  if (!weather) return null;

  const { current, range, hourly } = weather;
  const w = wind(current.wind.speed, unit);
  const v = visibility(current.visibility, unit);
  const gust = wind(current.wind.gust, unit);
  const dew = dewPoint(current.temp, current.humidity);
  const delta = Math.round(current.feelsLike) - Math.round(current.temp);
  const pressureDelta = current.pressure - 1013;

  return (
    <div className="page">
      <section className="hero">
        <p className="hero__place">{placeLabel(current.place)}</p>
        <p className="faint hero__date">
          {formatFullDate(current.observedAt, current.tz)} · {formatTime(current.observedAt, current.tz)} local
        </p>

        <div className="hero__reading">
          <WeatherIcon code={current.condition.code} size={92} title={current.condition.description} />
          <p className="hero__temp tnum">
            {temp(current.temp, unit)}<span>{degreeLabel(unit)}</span>
          </p>
        </div>

        <p className="hero__condition">{titleCase(current.condition.description || current.condition.label)}</p>
        <p className="muted hero__sub">
          Feels like {tempShort(current.feelsLike, unit)}
          {range ? <> · High {tempShort(range.max, unit)} · Low {tempShort(range.min, unit)}</> : null}
        </p>
        <p className="hero__stamp"><Stamp at={weather.fetchedAt} /></p>
      </section>

      <section className="panel">
        <SectionHeading title="Conditions" />
        <ul className="metrics">
          <Metric glyph="thermometer" label="Feels like" value={temp(current.feelsLike, unit)} unit={degreeLabel(unit)}
            hint={delta === 0 ? 'Matches the reading' : `${Math.abs(delta)}° ${delta > 0 ? 'warmer' : 'cooler'} than actual`} />
          <Metric glyph="droplet" label="Humidity" value={Math.round(current.humidity)} unit="%"
            hint={dew === null ? '' : `Dew point ${tempShort(dew, unit)}`} />
          <Metric glyph="wind" label="Wind" value={w.value} unit={w.unit}
            hint={[compass(current.wind.deg), current.wind.gust !== undefined ? `gusts ${gust.value} ${gust.unit}` : '']
              .filter(Boolean).join(' · ')} />
          <Metric glyph="gauge" label="Pressure" value={current.pressure} unit="hPa"
            hint={Math.abs(pressureDelta) < 3 ? 'Near average'
              : `${Math.abs(pressureDelta)} hPa ${pressureDelta > 0 ? 'above' : 'below'} average`} />
          <Metric glyph="eye" label="Visibility" value={v.value} unit={v.unit} hint={describeVisibility(current.visibility)} />
          <Metric glyph="cloud" label="Cloud cover" value={current.clouds ?? '—'} unit="%" hint={describeClouds(current.clouds)} />
        </ul>
      </section>

      <section className="panel">
        <SectionHeading title="Next few hours" aside={
          <button type="button" className="btn" onClick={() => navigate('hourly')}>All hours</button>
        } />
        <ul className="strip">
          {hourly.slice(0, 8).map((hour, i) => (
            <li key={hour.dt} className="strip__item" data-now={i === 0}>
              <span className="strip__time tnum">{i === 0 ? 'Now' : formatHour(hour.dt, hour.tz)}</span>
              <WeatherIcon code={hour.condition.code} size={26} title={hour.condition.description} />
              <span className="strip__temp tnum">{tempShort(hour.temp, unit)}</span>
              <span className="strip__pop tnum">{hour.pop >= 10 ? `${Math.round(hour.pop)}%` : ''}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
