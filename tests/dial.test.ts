import { describe, expect, it } from 'vitest';
import { dragStart, dragTo, pointerAngle, segmentAngle, wheelSteps } from '../src/lib/dial';

describe('dial geometry', () => {
  it('splits the rim evenly', () => {
    expect(segmentAngle(24)).toBe(15);
    expect(segmentAngle(16)).toBe(22.5);
  });
  it('measures pointer angles from the top, clockwise', () => {
    expect(pointerAngle(0, -10, 0, 0)).toBeCloseTo(0);
    expect(pointerAngle(10, 0, 0, 0)).toBeCloseTo(90);
    expect(pointerAngle(-10, 0, 0, 0)).toBeCloseTo(-90);
    expect(Math.abs(pointerAngle(0, 10, 0, 0))).toBeCloseTo(180);
  });
  it('turning the rim anticlockwise brings later segments under the pointer', () => {
    expect(dragTo(dragStart(0, 0), -30, 24).index).toBe(2);
    expect(dragTo(dragStart(5, 0), 15, 24).index).toBe(4);
  });
  it('keeps turning past half a turn instead of snapping back', () => {
    let s = dragStart(0, 0);
    for (const deg of [-60, -120, -170, 175, 120]) s = dragTo(s, deg, 24).state;
    expect(dragTo(s, 120, 24).index).toBe(16); // 240° anticlockwise in total
  });
  it('clamps to the rim’s ends', () => {
    expect(dragTo(dragStart(0, 0), 90, 24).index).toBe(0);
    expect(dragTo(dragStart(23, 0), -90, 24).index).toBe(23);
  });
  it('steps once per notch of trackpad travel, not once per event', () => {
    let acc = 0, steps = 0;
    for (let i = 0; i < 20; i++) { const r = wheelSteps(acc, 6); acc = r.acc; steps += r.steps; }
    expect(steps).toBe(3); // 120px of travel at 40px a step
  });
});
