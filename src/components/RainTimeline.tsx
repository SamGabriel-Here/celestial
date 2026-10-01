import type { Quarter } from '../lib/types';
import { clockLabel } from '../lib/units';

/** The next two hours of rain in 15-minute steps. */
export function RainTimeline({ quarters }: { quarters: Quarter[] }) {
  const q = quarters.slice(0, 8);
  if (!q.length) return null;
  const max = Math.max(0.5, ...q.map((x) => x.mm));
  const dry = q.every((x) => x.mm === 0);
  const summary = dry ? 'No rain in the next two hours' : q.filter((x) => x.mm > 0).map((x) => `${clockLabel(x.iso)} ${x.mm.toFixed(1)} mm`).join(', ');
  return (
    <section className="rain2h" aria-label={`Rain, next two hours: ${summary}`}>
      <h2>Next two hours</h2>
      <div className="bars" aria-hidden="true">
        {q.map((x) => <span key={x.iso} style={{ height: `${x.mm ? Math.max(8, (x.mm / max) * 100) : 0}%` }} />)}
      </div>
      <div className="ticks mono" aria-hidden="true">
        <span>{clockLabel(q[0]!.iso)}</span><span>{clockLabel(q[4]?.iso ?? q[0]!.iso)}</span><span>{clockLabel(q[q.length - 1]!.iso)}</span>
      </div>
      {dry && <p className="quiet small">No rain expected.</p>}
    </section>
  );
}
