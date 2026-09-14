import { Meter, SectionHeading, Empty } from '../components/parts';
import { SunArc } from '../components/SunArc';
import { MoonDial } from '../components/MoonDial';
import { useStore } from '../app/store';
import { placeKey, useFirstShow } from '../app/motion';
import { AQI_LEVELS, formatTime } from '../lib/format';

const POLLUTANTS: { key: 'pm2_5' | 'pm10' | 'o3' | 'no2' | 'so2' | 'co'; label: string; ceiling: number }[] = [
  { key: 'pm2_5', label: 'PM2.5', ceiling: 75 },
  { key: 'pm10', label: 'PM10', ceiling: 200 },
  { key: 'o3', label: 'O₃', ceiling: 180 },
  { key: 'no2', label: 'NO₂', ceiling: 200 },
  { key: 'so2', label: 'SO₂', ceiling: 350 },
  { key: 'co', label: 'CO', ceiling: 15000 },
];

export function AirView() {
  const { weather } = useStore();
  const traceSun = useFirstShow(weather ? `sun:${placeKey(weather.current.place)}` : null);
  // Phase is the same wherever you search, so the moon travels once per session.
  const traceMoon = useFirstShow('moon');
  if (!weather) return null;
  const { air, current } = weather;
  const level = air ? AQI_LEVELS[air.aqi] : null;

  return (
    <div className="page grid grid--2">
      <section className="panel">
        <SectionHeading title="Air quality" />
        {air && level ? (
          <div className="aqi">
            <p className="aqi__head" style={{ ['--tone' as string]: `var(--${level.tone})` }}>
              <span className="aqi__value tnum">{air.aqi}</span>
              <span className="aqi__label">{level.label}</span>
            </p>
            <div className="aqi__scale" role="img" aria-label={`Air quality index ${air.aqi} of 5 — ${level.label}`}>
              {[1, 2, 3, 4, 5].map((step) => (
                <span key={step} data-active={step <= air.aqi}
                  style={{ ['--tone' as string]: `var(--${level.tone})` }} />
              ))}
            </div>
            <p className="muted" style={{ fontSize: '0.86rem' }}>{level.note}</p>
            <ul className="pollutants">
              {POLLUTANTS.map(({ key, label, ceiling }) => {
                const value = air.components[key];
                if (value === undefined) return null;
                return (
                  <li key={key}>
                    <span className="label">{label}</span>
                    <span className="pollutants__value tnum">
                      {value.toFixed(value < 10 ? 1 : 0)} <i>µg/m³</i>
                    </span>
                    <Meter value={value / ceiling} tone={`var(--${level.tone})`} />
                  </li>
                );
              })}
            </ul>
            <p className="faint" style={{ fontSize: '0.78rem' }}>
              Measured {formatTime(air.measuredAt, current.tz)} local
            </p>
          </div>
        ) : (
          <Empty>No air-quality reading is available for this location.</Empty>
        )}
      </section>

      <section className="panel">
        <SectionHeading title="Sun cycle" />
        <SunArc sunrise={current.sunrise} sunset={current.sunset} tz={current.tz} trace={traceSun} />
      </section>

      <section className="panel">
        <SectionHeading title="Moon cycle" aside={<span className="faint">Tonight</span>} />
        <MoonDial trace={traceMoon} />
      </section>
    </div>
  );
}
