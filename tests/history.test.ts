import { expect, it, vi } from 'vitest';
import { writeUrl } from '../src/lib/history';

const fakeHistory = (current: string, fail = false) => {
  const calls: string[] = [];
  const h = {
    pushState: vi.fn((_: unknown, __: string, u: string) => { if (fail) throw new Error('SecurityError'); calls.push(`push ${u}`); }),
    replaceState: vi.fn((_: unknown, __: string, u: string) => { if (fail) throw new Error('SecurityError'); calls.push(`replace ${u}`); }),
  } as unknown as History;
  return { h, calls, loc: { pathname: '/', search: current.split('#')[0]!.slice(1), hash: '#' + current.split('#')[1] } };
};

it('skips a replace that would not change the URL', () => {
  const { h, calls } = fakeHistory('/?q=Tokyo#/now');
  writeUrl({ q: 'Tokyo', view: 'now', t: 0 }, false, h, { pathname: '/', search: '?q=Tokyo', hash: '#/now' });
  expect(calls).toEqual([]);
});
it('writes a changed URL', () => {
  const { h, calls } = fakeHistory('/?q=Tokyo#/now');
  writeUrl({ q: 'Tokyo', view: 'now', t: 3 }, false, h, { pathname: '/', search: '?q=Tokyo', hash: '#/now' });
  expect(calls).toEqual(['replace /?q=Tokyo&t=3#/now']);
});
it('never throws when the browser refuses (Safari rate-limits history writes)', () => {
  const { h } = fakeHistory('/?q=Tokyo#/now', true);
  expect(() => writeUrl({ q: 'Tokyo', view: 'now', t: 4 }, false, h, { pathname: '/', search: '?q=Tokyo', hash: '#/now' })).not.toThrow();
});
