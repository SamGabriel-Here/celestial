import { WeatherIcon } from '../components/icons';
import { Meter, SectionHeading } from '../components/parts';
import { TempCurve } from '../components/TempCurve';
import { useStore } from '../app/store';
import { formatHour, formatWeekday, tempShort, titleCase, wind } from '../lib/format';

export function HourlyView() {
  const { weather, unit } = useStore();
  if (!weather) return null;
  const { hourly } = weather;

  return (
    <div className="page">
      <section className="panel">
        <SectionHeading title="Hourly outlook" aside={<span className="faint">3-hour steps</span>} />
        <div className="curve__wrap">
          <TempCurve hours={hourly} unit={unit} />
        </div>
      </section>

      <section className="panel panel--flush">
        <ul className="rows">
          {hourly.map((hour, i) => {
            const w = wind(hour.wind, unit);
            return (
              <li key={hour.dt} className="row" data-now={i === 0}>
                <span className="row__lead">
                  <span className="row__name tnum">{i === 0 ? 'Now' : formatHour(hour.dt, hour.tz)}</span>
                  <span className="row__sub">{formatWeekday(hour.dt, hour.tz)}</span>
                </span>
                <WeatherIcon code={hour.condition.code} size={26} title={hour.condition.description} />
                <span className="row__desc">{titleCase(hour.condition.description)}</span>
                <span className="row__pop tnum">
                  {hour.pop >= 5 ? `${Math.round(hour.pop)}%` : '—'}
                  <Meter value={hour.pop / 100} />
                </span>
                <span className="row__wind tnum">{w.value} <i>{w.unit}</i></span>
                <span className="row__temp tnum">{tempShort(hour.temp, unit)}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
