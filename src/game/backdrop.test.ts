import { describe, expect, it } from 'vitest';
import {
  BACKDROP_COLUMN,
  BACKDROP_HEIGHT,
  BACKDROP_STYLES,
  getBackdropSeed,
  getBackdropStyle,
  getSilhouette,
  type BackdropLayer,
  type BackdropShape,
} from './backdrop.ts';
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
