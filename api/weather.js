/* =============================================================================
 * api/weather.js — Vercel serverless function.
 *
 * The browser never sees the OpenWeather key. It calls /api/weather?resource=…
 * and this function attaches the key server-side from an environment variable.
 *
 * CommonJS on purpose: there is no package.json, so Vercel's Node runtime treats
 * files here as CJS. The browser code in /js is ES modules — different runtime,
 * different rules.
 * ========================================================================== */

/** Only these upstreams can be reached. Not an open proxy. */
const UPSTREAM = {
  current: 'https://api.openweathermap.org/data/2.5/weather',
  forecast: 'https://api.openweathermap.org/data/2.5/forecast',
  air: 'https://api.openweathermap.org/data/2.5/air_pollution',
  geocode: 'https://api.openweathermap.org/geo/1.0/direct',
  reverse: 'https://api.openweathermap.org/geo/1.0/reverse',
};

/** Only these query params are forwarded. Anything else is dropped. */
const PASS_THROUGH = new Set(['lat', 'lon', 'q', 'limit', 'units', 'lang']);

const json = (res, status, body) => {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'method-not-allowed' });
  }

  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    // Deliberately explicit: this is the one failure the site owner must fix,
    // and it is not a secret that the variable is missing.
    return json(res, 503, {
      error: 'not-configured',
      message: 'OPENWEATHER_API_KEY is not set on the server.',
    });
  }

  const upstream = UPSTREAM[req.query.resource];
  if (!upstream) {
    return json(res, 400, { error: 'unknown-resource' });
  }

  const url = new URL(upstream);
  for (const [name, value] of Object.entries(req.query)) {
    if (PASS_THROUGH.has(name) && value !== undefined && value !== '') {
      url.searchParams.set(name, String(value));
    }
  }
  url.searchParams.set('appid', key);

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch {
    return json(res, 502, { error: 'upstream-unreachable' });
  }

  const body = await upstreamResponse.text();
  res.status(upstreamResponse.status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Weather moves slowly; let the edge absorb repeat traffic so one popular
  // city does not spend a fresh OpenWeather call per visitor.
  res.setHeader(
    'Cache-Control',
    upstreamResponse.ok ? 'public, s-maxage=600, stale-while-revalidate=1800' : 'no-store'
  );
  res.send(body);
};
