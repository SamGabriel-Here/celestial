/** Degrees per rim segment. */
export const segmentAngle = (n: number): number => 360 / n;

/** Angle of a point around a centre: 0° at the top, clockwise positive, in (-180, 180]. */
export function pointerAngle(x: number, y: number, cx: number, cy: number): number {
  return (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI;
}

/**
 * Which segment sits under the fixed pointer after dragging the rim from `startDeg` to `nowDeg`.
 * Turning the rim clockwise brings earlier segments to the top; the ±180° seam is unwrapped.
 */
export function indexFromDrag(startIndex: number, startDeg: number, nowDeg: number, n: number): number {
  let d = startDeg - nowDeg;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return Math.max(0, Math.min(n - 1, startIndex + Math.round(d / segmentAngle(n))));
}
