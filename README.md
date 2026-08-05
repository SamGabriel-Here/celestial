# Celestial

A compact weather dashboard — current conditions, an hourly outlook, five days ahead,
daylight, and air quality. HTML, CSS and vanilla ES modules. No frameworks, no build step.

## How the API key is handled

The key never ships to the browser on the deployed site. Requests go to
`/api/weather`, and the serverless function in `api/weather.js` attaches the key
from an environment variable. That function is not an open proxy: it allowlists
five upstream endpoints and six query parameters, and drops everything else.

There are two modes, and Celestial picks whichever is available.

**Proxy mode** — the default, and what production uses. Set
`OPENWEATHER_API_KEY` in your Vercel project (Settings → Environment Variables),
redeploy, and every visitor gets weather with nothing to configure.

**Direct mode** — for local work off a plain static server. Put a key in
`js/config.js`, or paste one into the app's setup panel. A key set either way is
visible to anyone who views source, so don't ship one this way publicly. A key
supplied for direct mode always overrides the proxy.

Get a key free at [openweathermap.org/api](https://openweathermap.org/api). New
keys take about ten minutes to activate.

## Run it

With the serverless function, so you exercise what production runs:

```bash
npx vercel dev
```

Or as a pure static site — the app detects that no proxy is there and asks for a
key. ES modules and geolocation both need `http://`, not `file://`:

```bash
python3 -m http.server 4180 --directory .
```

## What's in it

| File | Responsibility |
| --- | --- |
| `api/weather.js` | Serverless proxy; holds the key, allowlists upstreams and params |
| `js/config.js` | Mode selection, endpoints, tunables — the only file you need to edit |
| `js/api.js` | Every `fetch`; timeouts, aborts, and human-readable error mapping |
| `js/transform.js` | Raw OpenWeather payloads → flat view models (pure functions) |
| `js/format.js` | Units, timezone-aware dates, compass points, relative time |
| `js/icons.js` | Inline SVG weather and interface glyphs |
| `js/ui.js` | All DOM reads and writes; renderers take data + unit, nothing else |
| `js/app.js` | State, events, and the glue between the two layers |

Data flows one way: `api → transform → ui`. `ui.js` never fetches; `api.js` and
`transform.js` never touch the DOM.

## Endpoints used

Named by the `resource` parameter the client sends to the proxy:

| `resource` | Upstream | Purpose |
| --- | --- | --- |
| `geocode` | `/geo/1.0/direct` | city name → coordinates (better than `?q=`) |
| `reverse` | `/geo/1.0/reverse` | coordinates → place name, for geolocation |
| `current` | `/data/2.5/weather` | current conditions |
| `forecast` | `/data/2.5/forecast` | 5 days in 3-hour steps; feeds hourly *and* daily |
| `air` | `/data/2.5/air_pollution` | air quality; optional, never blocks the page |

Successful proxy responses carry `s-maxage=600`, so Vercel's edge absorbs repeat
traffic and one popular city doesn't cost a fresh OpenWeather call per visitor.
Errors are never cached.

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
