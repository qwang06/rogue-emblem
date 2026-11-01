import { describe, expect, it } from 'vitest';
import { getFitZoom } from './camera.ts';

const CANVAS = { width: 960, height: 720 };

describe('getFitZoom', () => {
  it('zooms a 20x15 map of 16px tiles to exactly fill a 960x720 canvas', () => {
    expect(getFitZoom({ width: 20, height: 15 }, 16, CANVAS, 8)).toBe(3);
  });

  it('caps small maps at maxZoom', () => {
    expect(getFitZoom({ width: 3, height: 3 }, 16, CANVAS, 8)).toBe(8);
  });

  it('is limited by whichever side fits worse', () => {
    // 30 tiles across is 480px at 1x, so only 2x fits the width.
    expect(getFitZoom({ width: 30, height: 3 }, 16, CANVAS, 20)).toBe(2);
    // 20 tiles down is 320px at 1x, so only 2x fits the height.
    expect(getFitZoom({ width: 3, height: 20 }, 16, CANVAS, 20)).toBe(2);
  });

  it('rounds down to a whole zoom', () => {
    expect(getFitZoom({ width: 25, height: 15 }, 16, CANVAS, 8)).toBe(2);
  });

  it('never goes below 1 for maps too big to fit', () => {
    expect(getFitZoom({ width: 100, height: 100 }, 16, CANVAS, 8)).toBe(1);
  });

  it('steps in fractions when given a step', () => {
    // An 8x8 map of 32px tiles is 256px: 768px tall fits 3x, capped at 2.5.
    expect(getFitZoom({ width: 8, height: 8 }, 32, { width: 1200, height: 768 }, 2.5, 0.5)).toBe(2.5);
    // 700px fits 2.73x, which rounds down to 2.5.
    expect(getFitZoom({ width: 8, height: 8 }, 32, { width: 1200, height: 700 }, 3, 0.5)).toBe(2.5);
    // 600px fits 2.34x, which rounds down to 2.
    expect(getFitZoom({ width: 8, height: 8 }, 32, { width: 1200, height: 600 }, 3, 0.5)).toBe(2);
  });
});
