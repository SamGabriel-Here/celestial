import { describe, expect, it } from 'vitest';
import { indexFromDrag, pointerAngle, segmentAngle } from '../src/lib/dial';

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
    expect(indexFromDrag(0, 0, -30, 24)).toBe(2);
    expect(indexFromDrag(5, 0, 15, 24)).toBe(4);
  });
  it('drags across the ±180° seam without jumping', () => {
    expect(indexFromDrag(10, 170, -175, 24)).toBe(9); // moved +15° clockwise across the seam
  });
  it('clamps to the rim’s ends', () => {
    expect(indexFromDrag(0, 0, 90, 24)).toBe(0);
    expect(indexFromDrag(23, 0, -90, 24)).toBe(23);
  });
});
