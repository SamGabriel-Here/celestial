/* =============================================================================
 * app.js — application state and event wiring. This is the only module that
 * knows about both the network layer and the DOM layer.
 * ========================================================================== */

import { canRequest, setSessionKey } from './config.js';
import { ApiError, fetchWeatherBundle, geocodeCity, reverseGeocode, getCurrentPosition } from './api.js';
import { buildDashboardModel } from './transform.js';
import { UNITS, placeLabel } from './format.js';
import * as ui from './ui.js';

const SUGGESTIONS = ['London', 'Tokyo', 'New York', 'Cape Town', 'Reykjavík'];
const RECENT_LIMIT = 6;
const REFRESH_MS = 10 * 60 * 1000;
const STAMP_TICK_MS = 30 * 1000;

/** Single source of truth. `recent` is deliberately never persisted. */
const state = {
  unit: UNITS.METRIC,
  theme: 'dark',
  place: null,
  model: null,
  recent: [],
  inFlight: null,
  retry: null,
};

/* --- Small persistence helper (preferences only, never search history) --- */

const store = {
  get(key, fallback) {
    try {
      return localStorage.getItem(`celestial:${key}`) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`celestial:${key}`, value);
    } catch {
      /* Private mode or blocked storage — preferences just won't survive a reload. */
    }
  },
};

/* --- Loading ------------------------------------------------------------- */

const placeId = (place) => `${place.lat.toFixed(3)},${place.lon.toFixed(3)}`;

/**
 * Fetch + transform + render for one place.
 * `background` keeps existing data on screen (and on failure) for auto-refreshes.
 */
async function loadPlace(place, { background = false } = {}) {
  state.inFlight?.abort('superseded');
  const controller = new AbortController();
  state.inFlight = controller;

  state.place = place;
  state.retry = () => loadPlace(place);

  // With data already on screen we refresh in place; otherwise show skeletons.
  if (state.model) ui.setBusy(true);
  else ui.setState('loading');

  try {
    const bundle = await fetchWeatherBundle(place.lat, place.lon, { signal: controller.signal });
    state.model = buildDashboardModel(bundle, place);
    ui.renderDashboard(state.model, state.unit);
    rememberPlace(place);
    ui.renderRecent(state.recent, placeId(place));
    ui.announce(`Weather for ${placeLabel(place)} updated.`);
  } catch (error) {
    if (isAbort(error)) return;
    // A failed background refresh should not wipe out good data.
    if (background && state.model) {
      ui.announce('Could not refresh the forecast. Showing the last known reading.');
      return;
    }
    handleError(error);
  } finally {
    if (state.inFlight === controller) {
      state.inFlight = null;
      ui.setBusy(false);
    }
  }
}

async function searchCity(query) {
  const term = query.trim();
  if (!term) {
    ui.els.cityInput.focus();
    ui.announce('Type a city name to search.');
    return;
  }

  state.retry = () => searchCity(term);
  if (!state.model) ui.setState('loading');
  else ui.setBusy(true);

  try {
    const [place] = await geocodeCity(term);
    await loadPlace(place);
  } catch (error) {
    if (isAbort(error)) return;
    ui.setBusy(false);
    handleError(error);
  }
}

async function useMyLocation() {
  state.retry = useMyLocation;
  if (!state.model) ui.setState('loading');
  else ui.setBusy(true);

  try {
    const { lat, lon } = await getCurrentPosition();
    const place = await reverseGeocode(lat, lon);
    await loadPlace({ ...place, lat, lon });
  } catch (error) {
    if (isAbort(error)) return;
    ui.setBusy(false);
    handleError(error);
  }
}

const isAbort = (error) => error?.name === 'AbortError';

function handleError(error) {
  // Everything here is fixed by supplying a key, so send people to the key form.
  const SETUP_REASONS = {
    'no-key': 'missing',
    auth: 'rejected',
    'proxy-unconfigured': 'unconfigured',
    'proxy-missing': 'missingProxy',
  };
  if (error instanceof ApiError && SETUP_REASONS[error.code]) {
    ui.showSetup(SETUP_REASONS[error.code]);
    return;
  }
  const message =
    error instanceof ApiError ? error.message : 'Something unexpected went wrong. Please try again.';
  ui.showError(message);
  if (!(error instanceof ApiError)) console.error(error);
}

/* --- Recent searches (memory only) --------------------------------------- */

function rememberPlace(place) {
  const entry = { id: placeId(place), label: placeLabel(place), place };
  state.recent = [entry, ...state.recent.filter((item) => item.id !== entry.id)].slice(0, RECENT_LIMIT);
}

/* --- Preferences --------------------------------------------------------- */

function setUnit(unit) {
  if (unit === state.unit) return;
  state.unit = unit;
  store.set('unit', unit);
  if (state.model) ui.renderDashboard(state.model, state.unit);
}

function setTheme(theme) {
  state.theme = theme;
  store.set('theme', theme);
  ui.setThemeUI(theme);
}

/* --- Wiring -------------------------------------------------------------- */

function bindEvents() {
  ui.els.searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    searchCity(ui.els.cityInput.value);
  });

  ui.els.locateBtn.addEventListener('click', useMyLocation);
  ui.els.refreshBtn.addEventListener('click', () => state.place && loadPlace(state.place));
  ui.els.retryBtn.addEventListener('click', () => (state.retry ? state.retry() : ui.setState('empty')));

  ui.els.themeToggle.addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'));

  ui.els.unitToggle.addEventListener('change', (event) => setUnit(event.target.value));

  ui.els.clearRecent.addEventListener('click', () => {
    state.recent = [];
    ui.renderRecent(state.recent, null);
    ui.els.cityInput.focus();
  });

  // Delegated: recent chips, suggestion chips, and the panel call-to-actions.
  document.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-place]');
    if (chip) {
      const entry = state.recent.find((item) => item.id === chip.dataset.place);
      if (entry) loadPlace(entry.place);
      return;
    }

    const suggestion = event.target.closest('[data-suggest]');
    if (suggestion) {
      ui.els.cityInput.value = suggestion.dataset.suggest;
      searchCity(suggestion.dataset.suggest);
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'locate') useMyLocation();
    if (action === 'focus-search') ui.els.cityInput.focus();
  });

  ui.els.hourlyPrev.addEventListener('click', () => ui.scrollHourly(-1));
  ui.els.hourlyNext.addEventListener('click', () => ui.scrollHourly(1));
  ui.els.hourlyTrack.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); ui.scrollHourly(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); ui.scrollHourly(-1); }
  });

  ui.els.setupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const key = ui.els.keyInput.value.trim();
    if (!key) return;
    setSessionKey(key);
    ui.els.keyInput.value = '';
    ui.setState('empty');
    if (state.retry) state.retry();
  });

  // "/" focuses search, Escape clears it.
  document.addEventListener('keydown', (event) => {
    const typing = /^(input|textarea)$/i.test(event.target.tagName);
    if (event.key === '/' && !typing) {
      event.preventDefault();
      ui.els.cityInput.focus();
    }
    if (event.key === 'Escape' && event.target === ui.els.cityInput) {
      ui.els.cityInput.value = '';
    }
  });

  // Come back to a stale tab and the reading refreshes itself.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !state.model || !state.place) return;
    if (Date.now() - state.model.fetchedAt > REFRESH_MS) loadPlace(state.place, { background: true });
  });
}

/* --- Boot ---------------------------------------------------------------- */

function init() {
  ui.mountStaticIcons();

  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  setTheme(store.get('theme', prefersLight ? 'light' : 'dark'));
  setUnitFromStorage();

  ui.renderSuggestions(SUGGESTIONS);
  ui.renderRecent(state.recent, null);
  bindEvents();

  // In proxy mode we start optimistic: whether the server holds a key is only
  // discoverable by asking it, so the first search surfaces any problem.
  if (canRequest()) ui.setState('empty');
  else ui.showSetup('missing');

  setInterval(() => state.model && ui.renderStamp(state.model.fetchedAt), STAMP_TICK_MS);
  setInterval(() => {
    if (state.place && document.visibilityState === 'visible') loadPlace(state.place, { background: true });
  }, REFRESH_MS);
}

function setUnitFromStorage() {
  const stored = store.get('unit', UNITS.METRIC);
  state.unit = stored === UNITS.IMPERIAL ? UNITS.IMPERIAL : UNITS.METRIC;
  const input = document.querySelector(`#unit-toggle input[value="${state.unit}"]`);
  if (input) input.checked = true;
}

init();
