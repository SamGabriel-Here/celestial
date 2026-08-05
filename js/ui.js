/* =============================================================================
 * ui.js — every DOM read/write lives here. Renderers take already-shaped data
 * plus the active unit, and never call the network.
 * ========================================================================== */

import { icon, weatherIcon, brandMark, themeFromCode } from './icons.js';
import {
  temp, tempShort, degreeLabel, wind, visibility, compass,
  formatTime, formatHour, formatWeekday, formatDayMonth, formatFullDate,
  relativeTime, placeLabel, titleCase, nowSeconds, zonedDateKey, AQI_LEVELS,
} from './format.js';
import { daylightProgress } from './transform.js';

const $ = (id) => document.getElementById(id);

export const els = {
  app: $('app'),
  live: $('live-region'),
  // controls
  searchForm: $('search-form'),
  cityInput: $('city-input'),
  locateBtn: $('locate-btn'),
  refreshBtn: $('refresh-btn'),
  themeToggle: $('theme-toggle'),
  themeGlyph: $('theme-glyph'),
  themeLabel: $('theme-label'),
  unitToggle: $('unit-toggle'),
  retryBtn: $('retry-btn'),
  setupForm: $('setup-form'),
  setupTitle: $('setup-title'),
  setupBody: $('setup-body'),
  keyInput: $('key-input'),
  // recent
  recent: $('recent'),
  recentList: $('recent-list'),
  clearRecent: $('clear-recent'),
  suggestions: $('suggestions'),
  // hero
  heroPlace: $('hero-place'),
  heroDate: $('hero-date'),
  heroIcon: $('hero-icon'),
  heroTemp: $('hero-temp'),
  heroUnit: $('hero-unit'),
  heroDesc: $('hero-desc'),
  heroSub: $('hero-sub'),
  heroUpdated: $('hero-updated'),
  // cards
  metrics: $('metrics-grid'),
  sunFill: $('sun-fill'),
  sunDot: $('sun-dot'),
  sunrise: $('sunrise-time'),
  sunset: $('sunset-time'),
  sunNote: $('sun-note'),
  hourlyTrack: $('hourly-track'),
  hourlyPrev: $('hourly-prev'),
  hourlyNext: $('hourly-next'),
  dailyList: $('daily-list'),
  airCard: $('air-card'),
  aqiValue: $('aqi-value'),
  aqiLabel: $('aqi-label'),
  aqiScale: $('aqi-scale'),
  aqiNote: $('aqi-note'),
  aqiComponents: $('aqi-components'),
  errorMessage: $('error-message'),
};

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);

/* --- Chrome ------------------------------------------------------------- */

/** Injects the SVGs that are part of the static markup. */
export function mountStaticIcons() {
  const brandHosts = [
    ['brand-mark', 24],
    ['empty-art', 32],
    ['setup-art', 32],
  ];
  for (const [id, size] of brandHosts) {
    const host = $(id);
    if (host) host.innerHTML = brandMark({ size });
  }

  const pairs = [
    ['search-icon', 'search', 17],
    ['locate-glyph', 'pin', 16],
    ['refresh-glyph', 'refresh', 15],
    ['hourly-prev-glyph', 'chevronLeft', 15],
    ['hourly-next-glyph', 'chevronRight', 15],
    ['sunrise-glyph', 'sunrise', 20],
    ['sunset-glyph', 'sunset', 20],
    ['air-glyph', 'leaf', 14],
    ['error-art', 'alert', 26],
  ];
  for (const [id, name, size] of pairs) {
    const host = $(id);
    if (host) host.innerHTML = icon(name, { size });
  }
}

export function setState(state) {
  els.app.dataset.state = state;
}

export function setBusy(busy) {
  els.app.dataset.busy = busy ? 'true' : 'false';
  els.refreshBtn?.querySelector('svg')?.classList.toggle('is-spinning', busy);
}

export function announce(message) {
  els.live.textContent = message;
}

// Static, author-written copy — safe to assign as HTML.
const SETUP_COPY = {
  missing: {
    title: 'Add an OpenWeather API key',
    body: `Celestial needs a free OpenWeather key. Put it in <code>js/config.js</code> for good,
           or paste one below to use for this session only — it is kept in memory and never saved.`,
  },
  rejected: {
    title: 'That key was rejected',
    body: `OpenWeather turned this key down. If you only just created it, give it ten minutes or so
           to activate — that is far and away the usual cause. Otherwise paste a different key below.`,
  },
  unconfigured: {
    title: 'The server has no key yet',
    body: `Celestial is running in proxy mode, but <code>OPENWEATHER_API_KEY</code> is not set on the
           server. Add it in your Vercel project settings and redeploy — or paste a key below to use
           this browser session only.`,
  },
  missingProxy: {
    title: 'No weather proxy here',
    body: `This copy of Celestial expects a serverless function at <code>/api/weather</code>, and a
           plain static server has none. Paste a key below to call OpenWeather directly instead.`,
  },
};

/**
 * A rejected key lands here rather than on the generic error panel: the fix is
 * always "try another key", so put the input in front of the person.
 */
export function showSetup(reason = 'missing') {
  const copy = SETUP_COPY[reason] ?? SETUP_COPY.missing;
  els.setupTitle.textContent = copy.title;
  els.setupBody.innerHTML = copy.body;
  setState('setup');
  if (reason === 'rejected') announce(copy.body);
}

export function showError(message) {
  els.errorMessage.textContent = message;
  setState('error');
  announce(message);
}

export function setThemeUI(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = theme;
  els.themeToggle.setAttribute('aria-pressed', String(dark));
  els.themeGlyph.innerHTML = icon(dark ? 'sun' : 'moon', { size: 17 });
  els.themeLabel.textContent = dark ? 'Switch to light theme' : 'Switch to dark theme';
}

export function setSky(code) {
  els.app.dataset.sky = themeFromCode(code);
}

/* --- Recent searches & suggestions -------------------------------------- */

export function renderRecent(entries, activeId) {
  els.recent.hidden = entries.length === 0;
  els.recentList.innerHTML = entries
    .map(
      (entry) => `
      <li>
        <button type="button" class="chip" data-place="${escapeHtml(entry.id)}"
          ${entry.id === activeId ? 'aria-current="true"' : ''}>
          ${escapeHtml(entry.label)}
        </button>
      </li>`
    )
    .join('');
}

export function renderSuggestions(cities) {
  els.suggestions.innerHTML = cities
    .map((city) => `<li><button type="button" class="chip" data-suggest="${escapeHtml(city)}">${escapeHtml(city)}</button></li>`)
    .join('');
}

/* --- Hero --------------------------------------------------------------- */

function renderHero(model, unit) {
  const { current, range } = model;
  els.heroPlace.textContent = placeLabel(current.place);
  els.heroDate.textContent = `${formatFullDate(current.observedAt, current.tz)} · ${formatTime(
    current.observedAt,
    current.tz
  )} local`;
  els.heroIcon.innerHTML = weatherIcon(current.condition.code, { size: 64 });
  els.heroTemp.textContent = temp(current.temp, unit);
  els.heroUnit.textContent = degreeLabel(unit);
  els.heroDesc.textContent = titleCase(current.condition.description || current.condition.label);

  const parts = [`Feels like ${tempShort(current.feelsLike, unit)}`];
  if (range) parts.push(`H ${tempShort(range.max, unit)} · L ${tempShort(range.min, unit)}`);
  els.heroSub.textContent = parts.join('  ·  ');
}

/** Split out so the "x min ago" stamp can tick without a full re-render. */
export function renderStamp(fetchedAt) {
  els.heroUpdated.textContent = fetchedAt ? `Updated ${relativeTime(fetchedAt)}` : '';
}

/* --- Metrics ------------------------------------------------------------ */

/** Magnus-Tetens approximation — a useful companion to raw humidity. */
function dewPoint(celsius, humidity) {
  if (!Number.isFinite(celsius) || !Number.isFinite(humidity) || humidity <= 0) return null;
  const gamma = (17.62 * celsius) / (243.12 + celsius) + Math.log(humidity / 100);
  return (243.12 * gamma) / (17.62 - gamma);
}

function buildMetrics(current, unit) {
  const w = wind(current.wind.speed, unit);
  const v = visibility(current.visibility, unit);
  const dew = dewPoint(current.temp, current.humidity);
  const delta = Number.isFinite(current.feelsLike) && Number.isFinite(current.temp)
    ? Math.round(current.feelsLike) - Math.round(current.temp)
    : 0;

  const gust = wind(current.wind.gust, unit);
  const pressureDelta = Number.isFinite(current.pressure) ? current.pressure - 1013 : null;

  return [
    {
      glyph: 'thermometer',
      label: 'Feels like',
      value: temp(current.feelsLike, unit),
      unit: degreeLabel(unit),
      hint: delta === 0 ? 'Matches the reading' : `${Math.abs(delta)}° ${delta > 0 ? 'warmer' : 'cooler'} than actual`,
    },
    {
      glyph: 'droplet',
      label: 'Humidity',
      value: Number.isFinite(current.humidity) ? Math.round(current.humidity) : '—',
      unit: '%',
      hint: dew === null ? '' : `Dew point ${tempShort(dew, unit)}`,
    },
    {
      glyph: 'wind',
      label: 'Wind',
      value: w.value,
      unit: w.unit,
      hint: [compass(current.wind.deg), Number.isFinite(current.wind.gust) ? `gusts ${gust.value} ${gust.unit}` : '']
        .filter(Boolean)
        .join(' · '),
    },
    {
      glyph: 'gauge',
      label: 'Pressure',
      value: Number.isFinite(current.pressure) ? current.pressure : '—',
      unit: 'hPa',
      hint:
        pressureDelta === null
          ? ''
          : Math.abs(pressureDelta) < 3
          ? 'Near average'
          : `${Math.abs(pressureDelta)} hPa ${pressureDelta > 0 ? 'above' : 'below'} average`,
    },
    {
      glyph: 'eye',
      label: 'Visibility',
      value: v.value,
      unit: v.unit,
      hint: describeVisibility(current.visibility),
    },
    {
      glyph: 'cloudCover',
      label: 'Cloud cover',
      value: Number.isFinite(current.clouds) ? Math.round(current.clouds) : '—',
      unit: '%',
      hint: describeClouds(current.clouds),
    },
  ];
}

const describeVisibility = (metres) => {
  if (!Number.isFinite(metres)) return '';
  if (metres >= 10000) return 'Clear to the horizon';
  if (metres >= 4000) return 'Slight haze';
  if (metres >= 1000) return 'Reduced — take care';
  return 'Poor visibility';
};

const describeClouds = (percentage) => {
  if (!Number.isFinite(percentage)) return '';
  if (percentage <= 10) return 'Open sky';
  if (percentage <= 40) return 'Mostly clear';
  if (percentage <= 75) return 'Partly cloudy';
  return 'Overcast';
};

function renderMetrics(current, unit) {
  els.metrics.innerHTML = buildMetrics(current, unit)
    .map(
      (metric) => `
      <li class="metric">
        <span class="metric__glyph">${icon(metric.glyph, { size: 15 })}</span>
        <span class="metric__label">${escapeHtml(metric.label)}</span>
        <span class="metric__value">${escapeHtml(metric.value)}<span class="metric__unit">${escapeHtml(
        metric.unit
      )}</span></span>
        ${metric.hint ? `<span class="metric__hint">${escapeHtml(metric.hint)}</span>` : ''}
      </li>`
    )
    .join('');
}

/* --- Sun ---------------------------------------------------------------- */

const ARC_LENGTH = Math.PI * 60;

function renderSun(current) {
  const { sunrise, sunset, tz } = current;
  els.sunrise.textContent = sunrise ? formatTime(sunrise, tz) : '—';
  els.sunset.textContent = sunset ? formatTime(sunset, tz) : '—';

  const progress = daylightProgress({ sunrise, sunset });
  const p = progress ?? (nowSeconds() < (sunrise ?? 0) ? 0 : 1);

  els.sunFill.style.strokeDashoffset = String(ARC_LENGTH * (1 - (progress ?? 0)));
  els.sunDot.setAttribute('cx', (80 - 60 * Math.cos(Math.PI * p)).toFixed(2));
  els.sunDot.setAttribute('cy', (66 - 60 * Math.sin(Math.PI * p)).toFixed(2));
  els.sunDot.style.opacity = progress === null ? '0.35' : '1';

  els.sunNote.textContent = describeDaylight(current);
}

function describeDaylight({ sunrise, sunset }) {
  if (!sunrise || !sunset) return '';
  const now = nowSeconds();
  const length = `${humanGap(sunset - sunrise)} of daylight`;

  if (now < sunrise) return `${length} · sunrise in ${humanGap(sunrise - now)}`;
  if (now > sunset) return `${length} · the sun has set`;
  return `${length} · ${humanGap(sunset - now)} until sunset`;
}

function humanGap(seconds) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes}m`;
}

/* --- Hourly ------------------------------------------------------------- */

function renderHourly(hourly, unit) {
  if (!hourly.length) {
    els.hourlyTrack.innerHTML = '<li class="hour"><span class="hour__time">No data</span></li>';
    return;
  }

  els.hourlyTrack.innerHTML = hourly
    .map((entry, index) => {
      const label = index === 0 ? 'Now' : formatHour(entry.dt, entry.tz);
      const rain = entry.pop >= 10 ? `${icon('droplet', { size: 11 })}${Math.round(entry.pop)}%` : '';
      return `
        <li class="hour" data-now="${index === 0}">
          <span class="hour__time">${escapeHtml(label)}</span>
          <span class="hour__icon">${weatherIcon(entry.condition.code, {
            size: 30,
            title: entry.condition.description,
          })}</span>
          <span class="hour__temp">${tempShort(entry.temp, unit)}</span>
          <span class="hour__pop">${rain}</span>
        </li>`;
    })
    .join('');
}

/* --- Daily -------------------------------------------------------------- */

function renderDaily(daily, unit) {
  const lows = daily.map((day) => day.min).filter(Number.isFinite);
  const highs = daily.map((day) => day.max).filter(Number.isFinite);
  const floor = lows.length ? Math.min(...lows) : 0;
  const ceiling = highs.length ? Math.max(...highs) : 1;
  const spread = Math.max(ceiling - floor, 1);

  els.dailyList.innerHTML = daily
    .map((day) => {
      const start = Number.isFinite(day.min) ? (day.min - floor) / spread : 0;
      const end = Number.isFinite(day.max) ? (day.max - floor) / spread : 1;
      const name = relativeDayName(day);
      const rain = day.pop >= 10 ? `${Math.round(day.pop)}% chance` : '';

      return `
        <li class="day">
          <span class="day__name">${escapeHtml(name)}
            <span class="day__date">${escapeHtml(formatDayMonth(day.dt, day.tz))}</span>
          </span>
          <span class="day__icon">${weatherIcon(day.condition.code, { size: 26, title: day.condition.description })}</span>
          <span>
            <span class="day__desc">${escapeHtml(titleCase(day.condition.description))}</span>
            <span class="day__pop">${escapeHtml(rain)}</span>
          </span>
          <span class="day__range">
            <span class="day__lo">${tempShort(day.min, unit)}</span>
            <span class="day__bar" style="--start:${start.toFixed(3)};--end:${Math.max(end, start + 0.06).toFixed(3)}"></span>
            <span class="day__hi">${tempShort(day.max, unit)}</span>
          </span>
        </li>`;
    })
    .join('');
}

/** "Today" / "Tomorrow" / weekday, judged in the city's own timezone. */
function relativeDayName(day) {
  const now = nowSeconds();
  if (day.key === zonedDateKey(now, day.tz)) return 'Today';
  if (day.key === zonedDateKey(now + 86400, day.tz)) return 'Tomorrow';
  return formatWeekday(day.dt, day.tz);
}

/* --- Air quality -------------------------------------------------------- */

const AQI_UNITS = { pm2_5: 'PM2.5', pm10: 'PM10', o3: 'O₃', no2: 'NO₂' };

function renderAir(air) {
  if (!air || !air.aqi) {
    els.airCard.hidden = true;
    return;
  }

  const level = AQI_LEVELS[air.aqi] ?? AQI_LEVELS[1];
  els.airCard.hidden = false;
  els.airCard.style.setProperty('--aqi-color', `var(--${level.tone})`);
  els.aqiValue.textContent = String(air.aqi);
  els.aqiLabel.textContent = level.label;
  els.aqiNote.textContent = level.note;
  els.aqiScale.setAttribute('aria-label', `Air quality index ${air.aqi} of 5 — ${level.label}`);

  for (const step of els.aqiScale.querySelectorAll('.aqi__step')) {
    step.dataset.active = String(Number(step.dataset.step) <= air.aqi);
  }

  els.aqiComponents.innerHTML = Object.entries(air.components)
    .filter(([, value]) => Number.isFinite(value))
    .map(
      ([key, value]) => `
      <li>
        <span class="aqi__k">${AQI_UNITS[key] ?? key}</span>
        <span class="aqi__v">${value.toFixed(value < 10 ? 1 : 0)} <i>µg/m³</i></span>
      </li>`
    )
    .join('');
}

/* --- Composite ---------------------------------------------------------- */

export function renderDashboard(model, unit) {
  renderHero(model, unit);
  renderMetrics(model.current, unit);
  renderSun(model.current);
  renderHourly(model.hourly, unit);
  renderDaily(model.daily, unit);
  renderAir(model.air);
  renderStamp(model.fetchedAt);
  setSky(model.current.condition.code);
  setState('ready');
}

/** Nudges the hourly strip by roughly one screenful. */
export function scrollHourly(direction) {
  const track = els.hourlyTrack;
  const step = Math.max(track.clientWidth * 0.75, 160);
  track.scrollBy({ left: direction * step, behavior: 'smooth' });
}
