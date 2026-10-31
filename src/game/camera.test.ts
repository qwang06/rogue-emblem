import { describe, expect, it } from 'vitest';
import { getCameraView, getFitZoom } from './camera.ts';

const CANVAS = { width: 960, height: 720 };

describe('getFitZoom', () => {
  it('zooms a 20x15 map of 16px tiles to exactly fill a 960x720 canvas', () => {
    expect(getFitZoom({ width: 20, height: 15 }, 16, CANVAS, 8)).toBe(3);
  });

  it('fits cells wider than tall by their own width and height', () => {
    // 10x6 cells of 64x40 are 640x240: width-bound at 1.5.
    expect(getFitZoom({ width: 10, height: 6 }, { width: 64, height: 40 }, CANVAS, 8, 0.5)).toBe(1.5);
    // 4x12 cells of 64x40 are 256x480: height-bound at 1.5.
    expect(getFitZoom({ width: 4, height: 12 }, { width: 64, height: 40 }, CANVAS, 8, 0.5)).toBe(1.5);
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
});

describe('getFitZoom with half steps', () => {
  it('rounds down to a half step', () => {
    // 20x15 64px tiles is 1280x960, so 960x720 fits 0.75x: 0.5x.
    expect(getFitZoom({ width: 20, height: 15 }, 64, CANVAS, 1.5, 0.5)).toBe(0.5);
    // 10x7 is 640x448: fits 1.5x.
    expect(getFitZoom({ width: 10, height: 7 }, 64, CANVAS, 3, 0.5)).toBe(1.5);
  });

  it('caps at maxZoom', () => {
    expect(getFitZoom({ width: 3, height: 3 }, 64, CANVAS, 1.5, 0.5)).toBe(1.5);
  });

  it('never goes below one step', () => {
    expect(getFitZoom({ width: 100, height: 100 }, 64, CANVAS, 1.5, 0.5)).toBe(0.5);
  });

  it('shows a map at the same screen size as at half the tile size and whole steps', () => {
    for (const map of [
      { width: 20, height: 15 },
      { width: 12, height: 9 },
      { width: 30, height: 4 },
    ]) {
      expect(getFitZoom(map, 64, CANVAS, 1.5, 0.5) * 64).toBe(getFitZoom(map, 32, CANVAS, 3) * 32);
    }
  });
});

describe('getCameraView', () => {
  it('is the canvas shrunk by the zoom, centered on the camera', () => {
    expect(getCameraView({ x: 320, y: 60 }, 2, { width: 1600, height: 800 })).toEqual({
      x: -80,
      y: -140,
      width: 800,
      height: 400,
    });
  });
});
