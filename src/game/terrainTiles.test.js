import { describe, expect, it } from 'vitest';
import { parseTerrainMap } from './terrainMap.js';
import { getCornerPiece, getTerrainFrame, getTerrainGridSize } from './terrainTiles.js';
import { TERRAIN_CORNER_FRAMES } from './tileset.js';

describe('getTerrainGridSize', () => {
  it('is one tile wider and taller than the map', () => {
    const grid = parseTerrainMap(['...', '...']);
    expect(getTerrainGridSize(grid)).toEqual({ width: 4, height: 3 });
  });
});

describe('getCornerPiece', () => {
  // A 2x2 pond in a 4x4 map: terrain tiles 1..3 cover its edges.
  const pond = parseTerrainMap([
    '....',
    '.~~.',
    '.~~.',
    '....',
  ]);

  it('names the one corner a tile touching the pond diagonally has in it', () => {
    expect(getCornerPiece(pond, 1, 1, 'water')).toBe('bottom-right');
    expect(getCornerPiece(pond, 3, 1, 'water')).toBe('bottom-left');
    expect(getCornerPiece(pond, 1, 3, 'water')).toBe('top-right');
    expect(getCornerPiece(pond, 3, 3, 'water')).toBe('top-left');
  });

  it('names both corners along a side of the pond', () => {
    expect(getCornerPiece(pond, 2, 1, 'water')).toBe('bottom-left+bottom-right');
    expect(getCornerPiece(pond, 2, 3, 'water')).toBe('top-left+top-right');
    expect(getCornerPiece(pond, 1, 2, 'water')).toBe('top-right+bottom-right');
    expect(getCornerPiece(pond, 3, 2, 'water')).toBe('top-left+bottom-left');
  });

  it('is all inside the pond and none away from it', () => {
    expect(getCornerPiece(pond, 2, 2, 'water')).toBe('all');
    expect(getCornerPiece(pond, 0, 0, 'water')).toBe('none');
  });

  it('names three corners at an inside corner and two at a diagonal', () => {
    const grid = parseTerrainMap(['~~', '~.']);
    expect(getCornerPiece(grid, 1, 1, 'water')).toBe('top-left+top-right+bottom-left');
    const diagonal = parseTerrainMap(['~.', '.~']);
    expect(getCornerPiece(diagonal, 1, 1, 'water')).toBe('top-left+bottom-right');
  });

  it('treats cells past the map edge as the nearest cell on it', () => {
    const grid = parseTerrainMap(['~.', '..']);
    // Top-left terrain tile: every corner is off the map but cell (0, 0).
    expect(getCornerPiece(grid, 0, 0, 'water')).toBe('all');
    // Along the top edge, the row above repeats row 0.
    expect(getCornerPiece(grid, 1, 0, 'water')).toBe('top-left+bottom-left');
    // Bottom-right terrain tile sees only grass.
    expect(getCornerPiece(grid, 2, 2, 'water')).toBe('none');
  });

  it('covers every corner combination with a frame', () => {
    const pieces = new Set();
    for (let mask = 0; mask < 16; mask++) {
      const row = (a, b) => `${mask & a ? '~' : '.'}${mask & b ? '~' : '.'}`;
      const grid = parseTerrainMap([row(8, 4), row(2, 1)]);
      pieces.add(getCornerPiece(grid, 1, 1, 'water'));
    }
    expect(pieces.size).toBe(16);
    expect([...pieces].sort()).toEqual(Object.keys(TERRAIN_CORNER_FRAMES.water).sort());
  });
});

describe('getTerrainFrame', () => {
  it('maps pieces to the frames on the grass/water sheet', () => {
    const grid = parseTerrainMap(['~~', '~.']);
    expect(getTerrainFrame(grid, 0, 0)).toBe(6); // all water
    expect(getTerrainFrame(grid, 1, 1)).toBe(7); // grass in the bottom-right corner
    expect(getTerrainFrame(grid, 2, 2)).toBe(12); // all grass
  });

  it('draws terrain without a corner set as grass', () => {
    const grid = parseTerrainMap(['..']);
    const lava = { ...grid, cells: grid.cells.map((cell) => ({ ...cell, terrain: 'lava' })) };
    expect(getTerrainFrame(lava, 1, 1)).toBe(TERRAIN_CORNER_FRAMES.water.none);
  });
});
