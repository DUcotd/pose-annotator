import { describe, expect, it } from 'vitest';
import {
  clamp,
  clampPoint,
  eventToNaturalPoint,
  getAdaptiveGridStep,
  getDisplayScale,
  zoomAroundPoint
} from './canvasMath';

describe('canvasMath (vitest)', () => {
  it('keeps values inside bounds', () => {
    expect(clamp(10, 0, 5)).toBe(5);
    expect(clamp(-1, 0, 5)).toBe(0);
    expect(clamp(3, 0, 5)).toBe(3);
    expect(clampPoint({ x: -10, y: 999 }, 640, 480)).toEqual({ x: 0, y: 480 });
  });

  it('computes display scale from image dims', () => {
    expect(getDisplayScale({ width: 100, height: 50, naturalWidth: 200, naturalHeight: 100 })).toEqual({
      sx: 0.5,
      sy: 0.5
    });
  });

  it('maps client coordinates to natural coordinates', () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 };
    expect(eventToNaturalPoint(110, 70, rect, 400, 200)).toEqual({ x: 200, y: 100 });
  });

  it('keeps zoom anchor fixed in viewport space', () => {
    const current = { zoom: 1, panX: 0, panY: 0 };
    const anchor = { x: 150, y: 100 };
    expect(zoomAroundPoint(current, anchor, 2)).toEqual({ zoom: 2, panX: -150, panY: -100 });
  });

  it('adapts grid size by zoom', () => {
    expect(getAdaptiveGridStep(0.6)).toBe(120);
    expect(getAdaptiveGridStep(1.0)).toBe(80);
    expect(getAdaptiveGridStep(1.5)).toBe(50);
    expect(getAdaptiveGridStep(2.2)).toBe(30);
  });
});
