import { WeatherIcon } from '../components/icons';
import { SectionHeading } from '../components/parts';
import { useStore } from '../app/store';
import {
  formatDayMonth, formatWeekdayLong, nowSeconds, tempShort, titleCase, wind, zonedDateKey,
} from '../lib/format';
import type { Day } from '../lib/transform';

/** "Today" / "Tomorrow" / weekday, judged in the city's own timezone. */
function dayName(day: Day): string {
  const now = nowSeconds();
  if (day.key === zonedDateKey(now, day.tz)) return 'Today';
  if (day.key === zonedDateKey(now + 86_400, day.tz)) return 'Tomorrow';
  return formatWeekdayLong(day.dt, day.tz);
}

export function ForecastView() {
  const { weather, unit } = useStore();
  if (!weather) return null;
  const { daily } = weather;

  const lows = daily.map((d) => d.min).filter((n): n is number => Number.isFinite(n));
  const highs = daily.map((d) => d.max).filter((n): n is number => Number.isFinite(n));
  const floor = lows.length ? Math.min(...lows) : 0;
  const ceiling = highs.length ? Math.max(...highs) : 1;
  const spread = Math.max(ceiling - floor, 1);

  return (
    <div className="page">
      <section className="panel">
        <SectionHeading title="Five days ahead" aside={<span className="faint">Range across the week</span>} />
        <ul className="days">
          {daily.map((day) => {
            const start = Number.isFinite(day.min) ? (day.min! - floor) / spread : 0;
            const end = Number.isFinite(day.max) ? (day.max! - floor) / spread : 1;
            const w = wind(day.wind, unit);
            return (
              <li key={day.key} className="day">
                <span className="day__head">
                  <span className="day__name">{dayName(day)}</span>
                  <span className="day__date faint">{formatDayMonth(day.dt, day.tz)}</span>
                </span>
                <WeatherIcon code={day.condition.code} size={34} title={day.condition.description} />
                <span className="day__desc">
                  {titleCase(day.condition.description)}
                  <span className="faint day__extra tnum">
                    {day.pop >= 10 ? `${Math.round(day.pop)}% chance · ` : ''}{w.value} {w.unit} · {day.humidity}% humidity
                  </span>
                </span>
                <span className="day__range tnum">
                  <span className="day__lo">{tempShort(day.min, unit)}</span>
                  <span className="day__bar">
                    <i style={{
                      left: `${start * 100}%`,
                      right: `${100 - Math.max(end, start + 0.06) * 100}%`,
                    }} />
                  </span>
                  <span className="day__hi">{tempShort(day.max, unit)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
