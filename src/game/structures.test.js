import { describe, expect, it } from 'vitest';
import { getStructureTiles } from './structures.js';
import { STRUCTURE_SPRITES } from './tileset.js';

describe('getStructureTiles', () => {
  it('covers every tile of the structure from its top-left tile, in reading order', () => {
    const tiles = getStructureTiles({ width: 3, height: 2 }, 7, 3);
    expect(tiles.map(({ x, y, frame }) => [x, y, frame])).toEqual([
      [7, 3, 0],
      [8, 3, 1],
      [9, 3, 2],
      [7, 4, 3],
      [8, 4, 4],
      [9, 4, 5],
    ]);
  });

  it('draws the top roofRows rows over units and the rest under them', () => {
    const tiles = getStructureTiles({ width: 2, height: 3, roofRows: 1 }, 0, 0);
    expect(tiles.map(({ y, overUnits }) => [y, overUnits])).toEqual([
      [0, true],
      [0, true],
      [1, false],
      [1, false],
      [2, false],
      [2, false],
    ]);
  });

  it('draws everything under units when there is no roof', () => {
    expect(getStructureTiles({ width: 1, height: 2 }, 4, 4).every((t) => !t.overUnits)).toBe(true);
  });

  it('puts only the gate roof over units', () => {
    const tiles = getStructureTiles(STRUCTURE_SPRITES.gate, 7, 3);
    expect(tiles.filter((t) => t.overUnits).map(({ x, y }) => [x, y])).toEqual([
      [7, 3],
      [8, 3],
      [9, 3],
    ]);
  });
});
