import { describe, expect, it } from 'vitest';
import { worldToGrid } from './grid.ts';
import {
  ART_FEET_Y,
  getPropPlacement,
  getCastShadowLayout,
  getScaledArtOrigin,
  getStandingDepth,
  getStandingPosition,
  STANDING_DEPTH_MAX,
  STANDING_DEPTH_MIN,
  STANDING_OVERHANG,
} from './sideView.ts';
import { CELL, TILE_SIZE } from './tileset.ts';

describe('getStandingPosition', () => {
  it("puts a sprite's feet inside its own cell", () => {
    for (const [x, y] of [
      [0, 0],
      [3, 2],
      [7, 7],
    ]) {
      const pos = getStandingPosition(x, y);
      const feet = { x: pos.x + TILE_SIZE / 2, y: pos.y + ART_FEET_Y };
      expect(worldToGrid(feet.x, feet.y, CELL)).toEqual({ x, y });
    }
  });

  it('lets the body rise over the cell behind', () => {
    const pos = getStandingPosition(2, 3);
    expect(pos.y).toBeLessThan(3 * CELL.height);
  });

  it('steps one cell width per column and one cell height per row', () => {
    const a = getStandingPosition(1, 1);
    const b = getStandingPosition(2, 3);
    expect(b.x - a.x).toBe(CELL.width);
    expect(b.y - a.y).toBe(2 * CELL.height);
  });
});

describe('getStandingDepth', () => {
  it('draws rows nearer the camera over rows behind', () => {
    const back = getStandingDepth(getStandingPosition(4, 1).y);
    const front = getStandingDepth(getStandingPosition(0, 2).y);
    expect(front).toBeGreaterThan(back);
  });

  it('ties within a row whatever the column', () => {
    expect(getStandingDepth(getStandingPosition(0, 5).y)).toBe(getStandingDepth(getStandingPosition(6, 5).y));
  });

  it('climbs smoothly while a sprite walks between rows', () => {
    const from = getStandingPosition(0, 2).y;
    const to = getStandingPosition(0, 3).y;
    const mid = getStandingDepth((from + to) / 2);
    expect(mid).toBeGreaterThan(getStandingDepth(from));
    expect(mid).toBeLessThan(getStandingDepth(to));
  });

  it('stays in the standing band, with room for a hair either side', () => {
    expect(getStandingDepth(-1000)).toBeGreaterThan(STANDING_DEPTH_MIN);
    expect(getStandingDepth(getStandingPosition(0, 0).y)).toBeGreaterThan(STANDING_DEPTH_MIN);
    expect(getStandingDepth(1e6)).toBe(STANDING_DEPTH_MAX);
  });
});

describe('STANDING_OVERHANG', () => {
  it('is how far a top-row sprite pokes above the floor', () => {
    expect(STANDING_OVERHANG).toBe(-getStandingPosition(0, 0).y);
  });
});

describe('getPropPlacement', () => {
  it('stands a one-cell prop like a unit', () => {
    expect(getPropPlacement({ x: 2, y: 3 })).toEqual({ ...getStandingPosition(2, 3), row: 3 });
  });

  it('stacks a piece behind its base a whole tile above per row, sorted on the base row', () => {
    const foot = getStandingPosition(4, 5);
    expect(getPropPlacement({ x: 4, y: 4, base: 5 })).toEqual({ x: foot.x, y: foot.y - TILE_SIZE, row: 5 });
    expect(getPropPlacement({ x: 4, y: 3, base: 5 })).toEqual({ x: foot.x, y: foot.y - 2 * TILE_SIZE, row: 5 });
  });
});

describe('getScaledArtOrigin', () => {
  it('is the top-left corner at 1x', () => {
    expect(getScaledArtOrigin(1)).toEqual({ x: 0, y: 0 });
  });

  it('keeps the feet of art drawn bigger where they are at 1x', () => {
    for (const scale of [1.25, 1.5, 2]) {
      const origin = getScaledArtOrigin(scale);
      const size = TILE_SIZE * scale;
      // The image's top-left corner, for a sprite positioned at the origin.
      const left = -origin.x * size;
      const top = -origin.y * size;
      expect(left + size / 2).toBeCloseTo(TILE_SIZE / 2);
      expect(top + (ART_FEET_Y / TILE_SIZE) * size).toBeCloseTo(ART_FEET_Y);
    }
  });
});

describe('getCastShadowLayout', () => {
  const apply = ([a, b, c, d, e, f]: number[], x: number, y: number) => ({
    x: a * x + c * y + e,
    y: b * x + d * y + f,
  });

  it('lands the feet on the anchor and lays the head down to the lower right', () => {
    const size = 256;
    const feetY = 232;
    const { width, height, transform, anchor } = getCastShadowLayout(size, feetY, { lean: 0.6, drop: 0.3 });
    const feet = apply(transform, size / 2, feetY);
    expect(feet.x / width).toBeCloseTo(anchor.x);
    expect(feet.y / height).toBeCloseTo(anchor.y);
    const head = apply(transform, size / 2, 0);
    expect(head.x - feet.x).toBeCloseTo(feetY * 0.6);
    expect(head.y - feet.y).toBeCloseTo(feetY * 0.3);
  });

  it('fits the whole image inside the canvas', () => {
    const size = 256;
    const { width, height, transform } = getCastShadowLayout(size, 232);
    for (const [x, y] of [
      [0, 0],
      [size, 0],
      [0, size],
      [size, size],
    ]) {
      const p = apply(transform, x, y);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(height);
    }
  });
});
