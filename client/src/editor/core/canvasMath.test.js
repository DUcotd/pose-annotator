import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp,
  clampPoint,
  eventToNaturalPoint,
  getAdaptiveGridStep,
  getDisplayScale,
  zoomAroundPoint
} from './canvasMath.js';

test('canvasMath.clamp and clampPoint keep values in bounds', () => {
  assert.equal(clamp(10, 0, 5), 5);
  assert.equal(clamp(-1, 0, 5), 0);
  assert.equal(clamp(3, 0, 5), 3);
  assert.deepEqual(clampPoint({ x: -10, y: 999 }, 640, 480), { x: 0, y: 480 });
});

test('canvasMath.getDisplayScale computes scale from image dims', () => {
  assert.deepEqual(getDisplayScale({ width: 100, height: 50, naturalWidth: 200, naturalHeight: 100 }), {
    sx: 0.5,
    sy: 0.5
  });
});

test('canvasMath.eventToNaturalPoint maps client coordinates correctly', () => {
  const rect = { left: 10, top: 20, width: 200, height: 100 };
  const p = eventToNaturalPoint(110, 70, rect, 400, 200);
  assert.equal(p.x, 200);
  assert.equal(p.y, 100);
});

test('canvasMath.zoomAroundPoint keeps anchor fixed in screen space', () => {
  const current = { zoom: 1, panX: 0, panY: 0 };
  const anchor = { x: 150, y: 100 };
  const next = zoomAroundPoint(current, anchor, 2);
  assert.equal(next.zoom, 2);
  assert.equal(next.panX, -150);
  assert.equal(next.panY, -100);
});

test('canvasMath.getAdaptiveGridStep adapts by zoom level', () => {
  assert.equal(getAdaptiveGridStep(0.6), 120);
  assert.equal(getAdaptiveGridStep(1.0), 80);
  assert.equal(getAdaptiveGridStep(1.5), 50);
  assert.equal(getAdaptiveGridStep(2.2), 30);
});

