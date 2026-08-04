# Celestial

A compact weather dashboard — current conditions, an hourly outlook, five days ahead,
daylight, and air quality. HTML, CSS and vanilla ES modules. No frameworks, no build step.

## Run it

1. **Get a key** — free at [openweathermap.org/api](https://openweathermap.org/api).
   New keys take about ten minutes to activate.
2. **Add it** — open `js/config.js` and replace the placeholder:

   ```js
   apiKey: 'your-key-here',
   ```

   You can also paste a key into the in-app setup panel; that one lives in memory
   for the session only and is never written anywhere.
3. **Serve the folder.** ES modules and the geolocation API both need `http://`,
   not `file://`:

   ```bash
   python3 -m http.server 4173 --directory .
   ```

   Then open <http://localhost:4173>.

## What's in it

| File | Responsibility |
| --- | --- |
| `js/config.js` | API key, endpoints, tunables — the only file you need to edit |
| `js/api.js` | Every `fetch`; timeouts, aborts, and human-readable error mapping |
| `js/transform.js` | Raw OpenWeather payloads → flat view models (pure functions) |
| `js/format.js` | Units, timezone-aware dates, compass points, relative time |
| `js/icons.js` | Inline SVG weather and interface glyphs |
| `js/ui.js` | All DOM reads and writes; renderers take data + unit, nothing else |
| `js/app.js` | State, events, and the glue between the two layers |

Data flows one way: `api → transform → ui`. `ui.js` never fetches; `api.js` and
`transform.js` never touch the DOM.

## Endpoints used

- `/geo/1.0/direct` — city name → coordinates (better disambiguation than `?q=`)
- `/geo/1.0/reverse` — coordinates → place name, for geolocation
- `/data/2.5/weather` — current conditions
- `/data/2.5/forecast` — 5 days in 3-hour steps, used for both hourly and daily
- `/data/2.5/air_pollution` — air quality; optional, failure never blocks the page

Everything is requested in metric and converted on the client, so the °C/°F toggle
re-renders without another request.

## Behaviour worth knowing

- **Times are local to the searched city**, not to you — OpenWeather's UTC offset
  is applied before formatting.
- **Hourly steps are three hours apart.** That is the resolution the free tier gives;
  true per-hour data needs the paid One Call plan.
- **Recent searches are in memory only** and disappear on reload, by design.
  Theme and unit preference are the only things stored (in `localStorage`).
- **Auto-refresh** every 10 minutes while the tab is visible, plus a catch-up
  refresh when you return to a stale tab. A failed background refresh keeps the
  last good reading on screen instead of blanking the dashboard.
- **Keyboard**: `/` focuses search, `Esc` clears it, arrow keys scroll the hourly
  strip when it has focus, and every control is reachable by Tab.

## States handled

Empty (first load) · loading skeletons · ready · error · missing API key.
Invalid cities, rejected keys, rate limits, timeouts, offline, denied geolocation
and unavailable geolocation each get their own message.
