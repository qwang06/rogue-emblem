import { describe, expect, it } from 'vitest';
import { type WangSet, getQuarterFrame, getWangFrameMap, getWangIndex, getWangQuarters } from './wangTiles.ts';
import { parseTerrainMap } from './terrainMap.ts';

const dirt: WangSet = { row: 0, terrains: ['dirt'], terrainIs: 'upper' };
const grass: WangSet = { row: 0, terrains: ['grass'], terrainIs: 'upper' };

describe('getWangIndex', () => {
  const map = parseTerrainMap(['..', '.,']);

  it('reads corners NW, NE, SW, SE as bits 8, 4, 2, 1', () => {
    expect(getWangIndex(map, 1, 1, dirt)).toBe(1);
    expect(getWangIndex(map, 1, 1, grass)).toBe(14);
  });

  it('flips the bits for a set whose terrain is its lower one', () => {
    expect(getWangIndex(map, 1, 1, { row: 0, terrains: ['dirt'], terrainIs: 'lower' })).toBe(14);
  });

  it('takes the nearest cell for corners off the map', () => {
    // The top-left corner of cell (0, 0): every corner is that cell.
    expect(getWangIndex(map, 0, 0, grass)).toBe(15);
    // The bottom-right corner of the dirt cell: all four corners are it.
    expect(getWangIndex(map, 2, 2, dirt)).toBe(15);
  });
});

describe('getWangQuarters', () => {
  it('gives a lone dirt cell an outer corner in each quarter', () => {
    const map = parseTerrainMap(['...', '.,.', '...']);
    // Top-left quarter: only its SE corner (the cell) is dirt, and so on.
    expect(getWangQuarters(map, 1, 1, dirt)).toEqual([1, 2, 4, 8]);
  });

  it('is all upper inside a patch and all lower outside it', () => {
    const map = parseTerrainMap([',,,', ',,,', ',,,', '...', '...']);
    expect(getWangQuarters(map, 1, 1, dirt)).toEqual([15, 15, 15, 15]);
    expect(getWangQuarters(map, 1, 4, dirt)).toEqual([0, 0, 0, 0]);
    // The patch's bottom row: its top half is dirt, its bottom half a border.
    expect(getWangQuarters(map, 1, 2, dirt)).toEqual([15, 15, 12, 12]);
  });
});

describe('getQuarterFrame', () => {
  it('cuts a sheet into half-size frames', () => {
    // A 16-tile-wide sheet is 32 quarters wide.
    expect(getQuarterFrame([0, 0], 0, 0, 16)).toBe(0);
    expect(getQuarterFrame([3, 1], 1, 1, 16)).toBe(3 * 32 + 7);
  });
});

describe('getWangFrameMap', () => {
  const map = parseTerrainMap(['..', '.,']);

  it('draws every quarter of a base set, from the opposite quarter of each corner tile', () => {
    const data = getWangFrameMap(map, { ...dirt, base: true }, 16);
    expect(data).toHaveLength(4);
    // Cell (0, 0)'s top-left quarter: corner tile 0, its bottom-right quarter.
    expect(data[0][0]).toBe(getQuarterFrame([0, 0], 1, 1, 16));
    // Cell (1, 1)'s top-left quarter: corner tile 1 (only SE is dirt).
    expect(data[2][2]).toBe(getQuarterFrame([1, 0], 1, 1, 16));
  });

  it("leaves out quarters with none of a set's own terrain", () => {
    const upper = getWangFrameMap(map, { ...dirt, row: 1 }, 16);
    expect(upper[0][0]).toBe(-1);
    expect(upper[3][3]).toBe(getQuarterFrame([15, 1], 0, 0, 16));

    const lower = getWangFrameMap(map, { row: 1, terrains: ['dirt'], terrainIs: 'lower' }, 16);
    expect(lower[0][0]).toBe(-1);
    expect(lower[2][2]).toBe(getQuarterFrame([14, 1], 1, 1, 16));
  });
});
