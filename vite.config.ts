/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

// The stylesheet is small (tokens, layout, @font-face); inlining it removes the one
// render-blocking request before first paint. Fonts still load from their own files.
const inlineCss = (): Plugin => ({
  name: 'celestial-inline-css',
  apply: 'build',
  enforce: 'post',
  generateBundle(_, bundle) {
    // Every page inlines its own stylesheets; a sheet shared by two pages is dropped only after both have it.
    const inlined = new Set<string>();
    for (const html of Object.values(bundle)) {
      if (html.type !== 'asset' || !html.fileName.endsWith('.html')) continue;
      let source = String(html.source);
      for (const [name, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'asset' || !name.endsWith('.css') || !source.includes(name)) continue;
        const tag = new RegExp(`<link rel="stylesheet"[^>]*href="/${name.replace(/[.]/g, '\\.')}"[^>]*>`);
        source = source.replace(tag, `<style>${String(chunk.source)}</style>`);
        inlined.add(name);
      }
      html.source = source;
    }
    for (const name of inlined) delete bundle[name];
  },
});

const COBALT = '#1b3a9c';

export default defineConfig({
  plugins: [
    react(),
    inlineCss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer', // keep the registration script out of the render path
      includeAssets: ['icons/favicon.svg'],
      manifest: {
        name: 'Celestial',
        short_name: 'Celestial',
        description: 'The real sky over any place, on a star wheel you turn to see the weather hour by hour.',
        theme_color: COBALT,
        background_color: COBALT,
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/about/], // the landing page is its own document, not the app shell
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        runtimeCaching: [
          {
            // Forecasts: fresh when online, last known when not. Stale-while-revalidate would
            // show the previous visit's forecast first even with a good connection.
            urlPattern: ({ url }) => url.hostname.endsWith('open-meteo.com'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-meteo',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 80, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Radar and map tiles are only useful live.
            urlPattern: ({ url }) => /rainviewer\.com$|arcgisonline\.com$/.test(url.hostname),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: { target: 'es2022', sourcemap: false, rollupOptions: { input: { main: 'index.html', about: 'about.html' } } },
  test: { include: ['tests/**/*.test.ts'] },
});
