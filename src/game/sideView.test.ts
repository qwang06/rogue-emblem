import { describe, expect, it } from 'vitest';
import { worldToGrid } from './grid.ts';
import {
  ART_FEET_Y,
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
