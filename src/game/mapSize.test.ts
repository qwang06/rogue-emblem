import { describe, expect, it } from 'vitest';
import { MAP_ARCHETYPES } from './mapArchetypes.ts';
import { MAP_GEN_DEFAULTS } from './mapGen.ts';
import {
  ARCHETYPE_SHAPES,
  CAVE_OPEN_SHARE,
  getMapSize,
  getTargetArea,
  MAX_MAP_SIZE,
  MIN_MAP_SIZE,
  OPEN_SHARE,
  resizeMapOptions,
  scaleCount,
  TILES_PER_UNIT,
} from './mapSize.ts';
import { createSeededRng } from './rng.ts';

// An Rng that always rolls `value`.
const always = (value: number) => () => value;
const MIDDLE = always(0.5);

describe('getTargetArea', () => {
  it('gives every unit TILES_PER_UNIT walkable tiles', () => {
    expect(getTargetArea(10)).toBe(Math.ceil((TILES_PER_UNIT * 10) / OPEN_SHARE));
    expect(getTargetArea(0)).toBe(0);
  });

  it('sizes a map with less open ground bigger', () => {
    expect(getTargetArea(10, CAVE_OPEN_SHARE)).toBeGreaterThan(getTargetArea(10));
    const cave = getMapSize(10, 'advance', MIDDLE, MIN_MAP_SIZE, CAVE_OPEN_SHARE);
    const field = getMapSize(10, 'advance', MIDDLE);
    expect(cave.width * cave.height).toBeGreaterThan(field.width * field.height);
  });
});

describe('getMapSize', () => {
  it('keeps a small fight at the smallest size', () => {
    expect(getMapSize(6, 'advance', MIDDLE)).toEqual(MIN_MAP_SIZE);
  });

  it('grows with the units on the field, wider before deeper', () => {
    const sizes = [6, 8, 10, 12, 14].map((units) => getMapSize(units, 'advance', MIDDLE));
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i].width * sizes[i].height).toBeGreaterThanOrEqual(sizes[i - 1].width * sizes[i - 1].height);
    }
    const last = sizes.at(-1)!;
    expect(last.width).toBeGreaterThan(last.height);
    expect(last.width * last.height).toBeGreaterThan(100);
  });

  it('gives each unit about TILES_PER_UNIT walkable tiles on a mid-sized fight', () => {
    const { width, height } = getMapSize(10, 'advance', MIDDLE);
    const perUnit = (width * height * OPEN_SHARE) / 10;
    expect(perUnit).toBeGreaterThan(TILES_PER_UNIT - 1);
    expect(perUnit).toBeLessThan(TILES_PER_UNIT + 1);
  });

  it('never passes the largest size, or an archetype’s own caps', () => {
    for (const archetype of MAP_ARCHETYPES) {
      const { width, height } = getMapSize(100, archetype, always(0.99));
      const shape = ARCHETYPE_SHAPES[archetype];
      expect(width).toBeLessThanOrEqual(Math.min(MAX_MAP_SIZE.width, shape.maxWidth ?? Infinity));
      expect(height).toBeLessThanOrEqual(Math.min(MAX_MAP_SIZE.height, shape.maxHeight ?? Infinity));
    }
  });

  it('shapes the map by its archetype: wide for a crossroads, squarer for an ambush', () => {
    const crossroads = getMapSize(12, 'crossroads', MIDDLE);
    const ambush = getMapSize(12, 'ambush', MIDDLE);
    expect(crossroads.width / crossroads.height).toBeGreaterThan(ambush.width / ambush.height);
  });

  it('lets the seed nudge the width a column either way', () => {
    const middle = getMapSize(10, 'advance', MIDDLE);
    expect(getMapSize(10, 'advance', always(0)).width).toBe(middle.width - 1);
    expect(getMapSize(10, 'advance', always(0.99)).width).toBe(middle.width + 1);
    expect(getMapSize(10, 'advance', always(0)).height).toBe(middle.height);
  });

  it('never goes below the region’s own size, even past the caps', () => {
    expect(getMapSize(1, 'advance', always(0), { width: 10, height: 9 })).toEqual({ width: 10, height: 9 });
    expect(getMapSize(1, 'gauntlet', MIDDLE, { width: 16, height: 12 })).toEqual({ width: 16, height: 12 });
  });

  it('is the same for the same Rng', () => {
    expect(getMapSize(11, 'islands', createSeededRng(5))).toEqual(getMapSize(11, 'islands', createSeededRng(5)));
  });
});

describe('scaleCount', () => {
  it('scales exactly on whole results and rounds by chance on fractions', () => {
    expect(scaleCount(2, 1.5, MIDDLE)).toBe(3);
    expect(scaleCount(3, 1.5, always(0.4))).toBe(5);
    expect(scaleCount(3, 1.5, always(0.6))).toBe(4);
    expect(scaleCount(0, 3, MIDDLE)).toBe(0);
  });
});

describe('resizeMapOptions', () => {
  const options = { width: 8, height: 8, lakes: 1, forests: 2, mountains: 0, buildings: 1, lakeSize: [2, 3] as const };

  it('sets the size and scales every count by the area, its default when unset', () => {
    const resized = resizeMapOptions(options, { width: 16, height: 8 }, MIDDLE);
    expect(resized).toMatchObject({ width: 16, height: 8, lakes: 2, forests: 4, mountains: 0, buildings: 2 });
    expect(resized.meadows).toBe(MAP_GEN_DEFAULTS.meadows * 2);
    expect(resized.ruins).toBe(MAP_GEN_DEFAULTS.ruins * 2);
    expect(resized.lakeSize).toEqual([2, 3]);
  });

  it('keeps the counts when the size stays the same', () => {
    expect(resizeMapOptions(options, { width: 8, height: 8 }, MIDDLE)).toMatchObject({ lakes: 1, forests: 2 });
  });
});
