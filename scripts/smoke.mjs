// Smoke test against the production preview (`npm run build && npm run preview`, port 4173).
// Drives the installed Chrome through playwright-core: three places × desktop and phone,
// every view, an offline reload, and the single batched request for saved places.
import { chromium } from 'playwright-core';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173';
const PLACES = ['Reykjavik', 'Tokyo', 'Bergen'];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const VIEWS = ['now', 'days', 'radar', 'air'];
const failures = [];
const fail = (what) => { failures.push(what); console.log(`  ✗ ${what}`); };
const ok = (what) => console.log(`  ✓ ${what}`);

// Count coarse colours across the window to tell a painted sky from a blank canvas.
const paintedColours = (page) => page.evaluate(() => {
  const c = document.querySelector('.dial-window canvas');
  if (!c || !c.width) return 0;
  const g = c.getContext('2d');
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const x = Math.floor(((i * 37) % 97) / 97 * c.width), y = Math.floor(((i * 61) % 89) / 89 * c.height);
    const [r, gg, b] = g.getImageData(x, y, 1, 1).data;
    seen.add(`${r >> 3},${gg >> 3},${b >> 3}`);
  }
  return seen.size;
});

const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    for (const place of PLACES) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      console.log(`${place} · ${name}`);
      for (const view of VIEWS) {
        await page.goto(`${BASE}/?q=${encodeURIComponent(place)}#/${view}`);
        await page.waitForSelector('.temp', { timeout: 15000 }).catch(() => fail(`${place}/${name}/${view}: no temperature`));
        const temp = (await page.textContent('.temp').catch(() => '')) ?? '';
        if (!temp.includes('°')) fail(`${place}/${name}/${view}: temperature reads "${temp}"`);
        if (view === 'radar') {
          await page.waitForSelector('.leaflet-container', { timeout: 15000 }).catch(() => fail(`${place}/${name}/radar: no map`));
        } else {
          await page.waitForSelector('.dial-window canvas', { timeout: 15000 });
          await page.waitForTimeout(500);
          const colours = await paintedColours(page);
          // A blank or failed canvas samples as one colour; even a clear night sky gives a dozen.
          if (colours <= 4) fail(`${place}/${name}/${view}: sky not painted (${colours} colours)`);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (overflow > 1) fail(`${place}/${name}/${view}: page is ${overflow}px wider than the viewport`);
      }
      if (errors.length) fail(`${place}/${name}: console errors — ${errors.slice(0, 3).join(' | ')}`); else ok(`${place} · ${name}: four views, no console errors`);
      await context.close();
    }
  }

  // Offline: the service worker keeps the last forecast.
  {
    const context = await browser.newContext({ viewport: VIEWPORTS.desktop, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${BASE}/?q=Tokyo`);
    await page.waitForSelector('.temp');
    await page.reload(); // now controlled by the service worker, responses cached
    await page.waitForSelector('.temp');
    await page.waitForTimeout(1000);
    await context.setOffline(true);
    await page.reload();
    const shown = await page.waitForSelector('.temp', { timeout: 15000 }).then(() => true).catch(() => false);
    const stamp = shown ? await page.textContent('.when') : '';
    if (shown && /as of/.test(stamp ?? '')) ok(`offline reload shows the last forecast (${stamp?.trim()})`);
    else fail(`offline reload: ${shown ? `no "as of" stamp in "${stamp}"` : 'nothing rendered'}`);
    await context.close();
  }

  // Saved places: one request for all their readings.
  {
    const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const P = (name, country, lat, lon) => ({ id: `${lat.toFixed(2)},${lon.toFixed(2)}`, name, country, lat, lon });
    await context.addInitScript((s) => localStorage.setItem('celestial:v1', s), JSON.stringify({
      v: 1, unit: 'c', saved: [P('Tokyo', 'JP', 35.6895, 139.69171), P('Bergen', 'NO', 60.39299, 5.32415), P('Reykjavik', 'IS', 64.13548, -21.89541)],
    }));
    const page = await context.newPage();
    let batches = 0;
    page.on('request', (r) => { if (r.url().includes('api.open-meteo.com') && decodeURIComponent(r.url()).includes('latitude=35.6895,60.39299')) batches++; });
    await page.goto(`${BASE}/?q=Tokyo`);
    await page.waitForSelector('.places li .num, .places li .go');
    await page.waitForTimeout(1500);
    if (batches === 1) ok('saved places: one batched request'); else fail(`saved places: ${batches} batched requests (want 1)`);
    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log('\nsmoke: all checks passed');
