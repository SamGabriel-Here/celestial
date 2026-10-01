/** Degrees per rim segment. */
export const segmentAngle = (n: number): number => 360 / n;

/** Angle of a point around a centre: 0° at the top, clockwise positive, in (-180, 180]. */
export function pointerAngle(x: number, y: number, cx: number, cy: number): number {
  return (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI;
}

export interface Drag { start: number; last: number; total: number }

export const dragStart = (index: number, deg: number): Drag => ({ start: index, last: deg, total: 0 });

/**
 * Follow a drag one pointer move at a time, summing the unwrapped change in angle, so a turn
 * past half a revolution keeps going. Turning the rim clockwise brings earlier segments to the top.
 */
export function dragTo(s: Drag, deg: number, n: number): { index: number; state: Drag } {
  let d = deg - s.last;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  const total = s.total + d;
  const index = Math.max(0, Math.min(n - 1, s.start + Math.round(-total / segmentAngle(n))));
  return { index, state: { ...s, last: deg, total } };
}

/** Trackpads send many small wheel deltas; step once per `px` of travel. */
export function wheelSteps(acc: number, delta: number, px = 40): { steps: number; acc: number } {
  const total = acc + delta;
  const steps = Math.trunc(total / px);
  return { steps, acc: total - steps * px };
}
