import { describe, expect, it } from 'vitest';
import {
  BACKDROP_COLUMN,
  BACKDROP_HEIGHT,
  BACKDROP_STYLES,
  BATTLEFIELD_LOOKS,
  getFloorFlecks,
  getPaintingCamera,
  getPaintingPlacement,
  getBackdropSeed,
  getBackdropStyle,
  getSilhouette,
  type BackdropLayer,
  type BackdropShape,
} from './backdrop.ts';
import { BATTLEFIELD_KINDS } from './battlefields.ts';
import { STANDING_OVERHANG } from './sideView.ts';
import { parseTerrainMap } from './terrainMap.ts';
import { REGION_BIOMES } from './warband/realm/realmRegions.ts';

const SHAPES: BackdropShape[] = ['hills', 'peaks', 'treeline', 'wall'];
const layer = (shape: BackdropShape): BackdropLayer => ({ shape, color: 0, low: 0.2, high: 0.6 });

describe('getBackdropStyle', () => {
  it('has a style for every region biome, and a default', () => {
    for (const biome of REGION_BIOMES) expect(getBackdropStyle(biome)).toBe(BACKDROP_STYLES[biome]);
    expect(getBackdropStyle(undefined)).toBe(BACKDROP_STYLES.default);
  });

  it('gives every style a sky and at least one silhouette inside the backdrop', () => {
    for (const style of Object.values(BACKDROP_STYLES)) {
      expect(style.sky.length).toBeGreaterThan(0);
      expect(style.layers.length).toBeGreaterThan(0);
      for (const { low, high } of style.layers) {
        expect(low).toBeGreaterThanOrEqual(0);
        expect(high).toBeLessThanOrEqual(1);
        expect(low).toBeLessThan(high);
      }
    }
  });
});

describe('getSilhouette', () => {
  it.each(SHAPES)('gives a %s one whole-pixel height per column, between its low and high', (shape) => {
    const heights = getSilhouette(layer(shape), 640, 100, 7);
    expect(heights).toHaveLength(640 / BACKDROP_COLUMN);
    for (const h of heights) {
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(20);
      expect(h).toBeLessThanOrEqual(60);
    }
  });

  it.each(SHAPES)('draws a %s the same from the same seed', (shape) => {
    expect(getSilhouette(layer(shape), 320, 100, 3)).toEqual(getSilhouette(layer(shape), 320, 100, 3));
  });

  it('varies with the seed', () => {
    expect(getSilhouette(layer('hills'), 320, 100, 1)).not.toEqual(getSilhouette(layer('hills'), 320, 100, 2));
  });

  it('covers a width that is not a whole number of columns', () => {
    expect(getSilhouette(layer('peaks'), 10, 50, 1)).toHaveLength(3);
  });

  it('crenellates a wall: merlons two columns wide, two apart', () => {
    const heights = getSilhouette(layer('wall'), 32, 100, 1);
    expect(heights).toEqual([60, 60, 44, 44, 60, 60, 44, 44]);
  });
});

describe('getBackdropSeed', () => {
  it('is the same for the same terrain and differs for different terrain', () => {
    const a = parseTerrainMap(['..~', 'T..']);
    expect(getBackdropSeed(a)).toBe(getBackdropSeed(parseTerrainMap(['..~', 'T..'])));
    expect(getBackdropSeed(a)).not.toBe(getBackdropSeed(parseTerrainMap(['...', 'T..'])));
  });
});

describe('BACKDROP_HEIGHT', () => {
  it('leaves room for the heads of units on the top row', () => {
    expect(BACKDROP_HEIGHT).toBeGreaterThanOrEqual(STANDING_OVERHANG);
  });
});

describe('BATTLEFIELD_LOOKS', () => {
  it('has a floor and backdrop for every battlefield, flecks leaving most of the floor its base', () => {
    for (const kind of BATTLEFIELD_KINDS) {
      const { floor, backdrop } = BATTLEFIELD_LOOKS[kind];
      expect(backdrop.layers.length).toBeGreaterThan(0);
      expect(floor.flecks.reduce((sum, { share }) => sum + share, 0)).toBeLessThan(0.5);
    }
  });
});

describe('getFloorFlecks', () => {
  const style = {
    base: 0,
    flecks: [
      { color: 1, share: 0.2 },
      { color: 2, share: 0.1 },
    ],
  };

  it("flecks about each color's share of the floor, on the pixel grid", () => {
    const flecks = getFloorFlecks(style, 400, 400, 5);
    const cells = (400 / BACKDROP_COLUMN) ** 2;
    const share = (color: number) => flecks.filter((f) => f.color === color).length / cells;
    expect(share(1)).toBeCloseTo(0.2, 1);
    expect(share(2)).toBeCloseTo(0.1, 1);
    expect(flecks.every(({ x, y }) => x % BACKDROP_COLUMN === 0 && y % BACKDROP_COLUMN === 0)).toBe(true);
    expect(flecks.every(({ x, y }) => x < 400 && y < 400)).toBe(true);
  });

  it('is the same from the same seed', () => {
    expect(getFloorFlecks(style, 64, 40, 2)).toEqual(getFloorFlecks(style, 64, 40, 2));
  });

  it('has none with no fleck colors', () => {
    expect(getFloorFlecks({ base: 0, flecks: [] }, 64, 40, 2)).toEqual([]);
  });
});

describe('getPaintingPlacement', () => {
  const painting = { size: [1920, 1080], field: [360, 290, 1200, 536] } as const;

  it('lays the field over the floor, keeping the picture’s shape', () => {
    const at = getPaintingPlacement(painting, 896);
    const scale = at.width / 1920;
    expect(at.height / at.width).toBeCloseTo(1080 / 1920);
    expect(at.x + 360 * scale).toBeCloseTo(0);
    expect(at.y + 290 * scale).toBeCloseTo(0);
    expect(1200 * scale).toBeCloseTo(896);
  });
});

describe('getPaintingCamera', () => {
  const painting = { x: -269, y: -217, width: 1434, height: 806 };
  const floor = { x: 0, y: -24, width: 896, height: 424 };

  it('zooms the painting to cover the canvas, centered on it', () => {
    const canvas = { width: 1600, height: 800 };
    const { zoom, center } = getPaintingCamera(painting, floor, canvas, 10);
    expect(zoom).toBeCloseTo(1600 / 1434);
    const view = { x: center.x - 800 / zoom, y: center.y - 400 / zoom };
    expect(view.x).toBeGreaterThanOrEqual(painting.x - 1e-9);
    expect(view.y).toBeGreaterThanOrEqual(painting.y - 1e-9);
    expect(view.x + 1600 / zoom).toBeLessThanOrEqual(painting.x + painting.width + 1e-9);
    expect(view.y + 800 / zoom).toBeLessThanOrEqual(painting.y + painting.height + 1e-9);
  });

  it('never zooms past the floor’s fit, keeping the floor in view', () => {
    // A tall, narrow canvas: covering would crop the floor's sides.
    const canvas = { width: 600, height: 900 };
    const fit = Math.min(600 / floor.width, 900 / floor.height);
    const { zoom, center } = getPaintingCamera(painting, floor, canvas, fit);
    expect(zoom).toBeCloseTo(fit);
    const half = { width: 300 / zoom, height: 450 / zoom };
    expect(center.x - half.width).toBeLessThanOrEqual(floor.x + 1e-9);
    expect(center.x + half.width).toBeGreaterThanOrEqual(floor.x + floor.width - 1e-9);
    expect(center.y - half.height).toBeLessThanOrEqual(floor.y + 1e-9);
    expect(center.y + half.height).toBeGreaterThanOrEqual(floor.y + floor.height - 1e-9);
  });
});
