import type { View } from './types';

export interface AppUrl {
  q?: string;
  at?: { lat: number; lon: number };
  view: View;
  t: number; // cursor hour, 0..35
}

const VIEWS: View[] = ['now', 'days', 'radar', 'air'];
const MAX_T = 35;

export function parseUrl(href: string): AppUrl {
  const u = new URL(href, 'https://celestial.local');
  const view = u.hash.replace(/^#\/?/, '') as View;
  const t = Number.parseInt(u.searchParams.get('t') ?? '0', 10);
  const out: AppUrl = { view: VIEWS.includes(view) ? view : 'now', t: Number.isFinite(t) ? Math.min(MAX_T, Math.max(0, t)) : 0 };
  const q = u.searchParams.get('q');
  if (q) out.q = q;
  const [lat, lon] = (u.searchParams.get('at') ?? '').split(',').map(Number);
  if (u.searchParams.has('at') && Number.isFinite(lat) && Number.isFinite(lon)) out.at = { lat: lat!, lon: lon! };
  return out;
}

export function buildUrl(u: AppUrl): string {
  const p = new URLSearchParams();
  if (u.q) p.set('q', u.q);
  else if (u.at) p.set('at', `${u.at.lat},${u.at.lon}`);
  if (u.t) p.set('t', String(u.t));
  const s = p.toString();
  return `/${s ? `?${s}` : ''}#/${u.view}`;
}
