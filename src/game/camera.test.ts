import { describe, expect, it } from 'vitest';
import { getFitZoom, getFollowView } from './camera.ts';

const TILE = 64;
const tile = (x: number, y: number) => ({ x: x * TILE, y: y * TILE, width: TILE, height: TILE });
// A 20x10-tile map (1280x640) seen through a 640x320 view, two tiles of
// margin.
const WORLD = { width: 20 * TILE, height: 10 * TILE };
const VIEW = { width: 10 * TILE, height: 5 * TILE };
const MARGIN = 2 * TILE;

describe('getFollowView', () => {
  it('centers a map that fits, on each axis it fits', () => {
    const view = { width: 1400, height: 1000 };
    expect(getFollowView({ x: 0, y: 0 }, tile(3, 3), view, WORLD, MARGIN)).toEqual({ x: -60, y: -180 });
    // Narrow but tall: the width scrolls, the height is centered.
    const narrow = { width: 640, height: 1000 };
    expect(getFollowView({ x: 0, y: 0 }, tile(0, 0), narrow, WORLD, MARGIN)).toEqual({ x: 0, y: -180 });
  });

  it("doesn't move while the focus stays inside the margin", () => {
    const start = { x: 4 * TILE, y: 2 * TILE };
    expect(getFollowView(start, tile(7, 4), VIEW, WORLD, MARGIN)).toEqual(start);
    expect(getFollowView(start, tile(6, 4), VIEW, WORLD, MARGIN)).toEqual(start);
  });

  it('scrolls just enough to keep the focus a margin from the edge', () => {
    const start = { x: 4 * TILE, y: 2 * TILE };
    // Tile 12 needs the view to end at tile 15 (12 + 1 + 2), so start at 5.
    expect(getFollowView(start, tile(12, 4), VIEW, WORLD, MARGIN)).toEqual({ x: 5 * TILE, y: 2 * TILE });
    // Tile 5 needs the view to start at tile 3.
    expect(getFollowView(start, tile(5, 2), VIEW, WORLD, MARGIN)).toEqual({ x: 3 * TILE, y: 0 });
  });

  it('never runs past the edges of the map', () => {
    expect(getFollowView({ x: 0, y: 0 }, tile(0, 0), VIEW, WORLD, MARGIN)).toEqual({ x: 0, y: 0 });
    expect(getFollowView({ x: 0, y: 0 }, tile(19, 9), VIEW, WORLD, MARGIN)).toEqual({ x: 10 * TILE, y: 5 * TILE });
  });

  it('shrinks a margin too big for the view so the focus still shows', () => {
    const tiny = { width: 2 * TILE, height: 2 * TILE };
    const at = getFollowView({ x: 0, y: 0 }, tile(10, 5), tiny, WORLD, 5 * TILE);
    expect(at.x).toBeLessThanOrEqual(10 * TILE);
    expect(at.x + tiny.width).toBeGreaterThanOrEqual(11 * TILE);
    expect(at.y).toBeLessThanOrEqual(5 * TILE);
    expect(at.y + tiny.height).toBeGreaterThanOrEqual(6 * TILE);
  });
});

describe('getFitZoom', () => {
  const map = { width: 8 * 32, height: 8 * 32 };

  it('picks the largest whole zoom the map fits at', () => {
    expect(getFitZoom({ width: 1460, height: 860 }, map)).toBe(3);
    expect(getFitZoom({ width: 1100, height: 1100 }, map)).toBe(4);
  });

  it('never goes below the minimum, even when the map does not fit', () => {
    expect(getFitZoom({ width: 826, height: 580 }, map)).toBe(2);
    expect(getFitZoom({ width: 100, height: 100 }, map)).toBe(2);
  });

  it('never goes above the maximum', () => {
    expect(getFitZoom({ width: 5000, height: 5000 }, map)).toBe(4);
    expect(getFitZoom({ width: 5000, height: 5000 }, map, 2, 3)).toBe(3);
  });

  it('falls back to the minimum for an empty map', () => {
    expect(getFitZoom({ width: 800, height: 600 }, { width: 0, height: 0 })).toBe(2);
  });
});
