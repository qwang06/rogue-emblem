import { describe, expect, it } from 'vitest';
import { getCameraView, getFitZoom, getFollowCenter, getRenderSize, MAX_PIXEL_RATIO } from './camera.ts';

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

describe('getRenderSize', () => {
  it('draws a canvas pixel per screen pixel on a scaled display', () => {
    expect(getRenderSize({ width: 1000, height: 600 }, 1.5)).toEqual({ width: 1500, height: 900, pixelRatio: 1.5 });
    expect(getRenderSize({ width: 1000, height: 600 }, 1)).toEqual({ width: 1000, height: 600, pixelRatio: 1 });
  });

  it('caps the ratio, never goes below 1, and never makes an empty canvas', () => {
    expect(getRenderSize({ width: 100, height: 100 }, 8).pixelRatio).toBe(MAX_PIXEL_RATIO);
    expect(getRenderSize({ width: 100, height: 100 }, 0.5).pixelRatio).toBe(1);
    expect(getRenderSize({ width: 100, height: 100 }, 0).pixelRatio).toBe(1);
    expect(getRenderSize({ width: 0, height: 0 }, 2)).toEqual({ width: 1, height: 1, pixelRatio: 2 });
  });
});

describe('getFollowCenter', () => {
  const view = { width: 400, height: 300 };
  const bounds = { x: 0, y: 0, width: 2000, height: 1000 };
  const margin = { width: 50, height: 40 };
  const cell = (x: number, y: number) => ({ x, y, width: 64, height: 40 });

  it('stays put while the focus is well inside the view', () => {
    expect(getFollowCenter({ x: 500, y: 400 }, cell(480, 380), view, bounds, margin)).toEqual({ x: 500, y: 400 });
  });

  it('moves just far enough to keep the focus a margin inside the right and bottom edges', () => {
    // The view spans 300..700 x 250..550; the cell ends at 764, 590.
    expect(getFollowCenter({ x: 500, y: 400 }, cell(700, 550), view, bounds, margin)).toEqual({
      x: 764 + 50 - 200,
      y: 590 + 40 - 150,
    });
  });

  it('moves just far enough to keep the focus a margin inside the left and top edges', () => {
    expect(getFollowCenter({ x: 500, y: 400 }, cell(310, 260), view, bounds, margin)).toEqual({
      x: 310 - 50 + 200,
      y: 260 - 40 + 150,
    });
  });

  it('never shows past the bounds', () => {
    expect(getFollowCenter({ x: 500, y: 400 }, cell(0, 0), view, bounds, margin)).toEqual({ x: 200, y: 150 });
    expect(getFollowCenter({ x: 500, y: 400 }, cell(1936, 960), view, bounds, margin)).toEqual({ x: 1800, y: 850 });
  });

  it('centers on the bounds along an axis the view is bigger than', () => {
    const narrow = { x: -100, y: 0, width: 300, height: 1000 };
    expect(getFollowCenter({ x: 500, y: 400 }, cell(700, 550), view, narrow, margin).x).toBe(50);
  });

  it('centers a focus too big for the view and its margin', () => {
    const big = { x: 100, y: 100, width: 380, height: 40 };
    expect(getFollowCenter({ x: 900, y: 120 }, big, view, bounds, margin).x).toBe(290);
  });
});
