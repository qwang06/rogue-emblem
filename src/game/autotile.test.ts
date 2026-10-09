import { describe, expect, it } from 'vitest';
import {
  getQuarterFrameMap,
  getQuarterFrames,
  getQuarterShapes,
  getShapeTile,
  getTileFrame,
  type Autotile,
  type QuarterShape,
} from './autotile.ts';
import { parseTerrainMap } from './terrainMap.ts';
import { TERRAIN_AUTOTILES, TERRAIN_BASE_TILE, TERRAIN_SHEET } from './tileset.ts';

const shapes = (tl: QuarterShape, tr: QuarterShape, bl: QuarterShape, br: QuarterShape) => ({
  'top-left': tl,
  'top-right': tr,
  'bottom-left': bl,
  'bottom-right': br,
});

describe('getQuarterShapes', () => {
  // A 3x3 pond with a 1-tile border of grass.
  const pond = parseTerrainMap(['.....', '.~~~.', '.~~~.', '.~~~.', '.....']);

  it('is null for a cell of other terrain', () => {
    expect(getQuarterShapes(pond, 0, 0, 'water')).toBeNull();
  });

  it('rounds the pond corners and borders its sides', () => {
    expect(getQuarterShapes(pond, 1, 1, 'water')).toEqual(shapes('outer', 'horizontal', 'vertical', 'full'));
    expect(getQuarterShapes(pond, 2, 1, 'water')).toEqual(shapes('horizontal', 'horizontal', 'full', 'full'));
    expect(getQuarterShapes(pond, 3, 3, 'water')).toEqual(shapes('full', 'vertical', 'horizontal', 'outer'));
  });

  it('is open water in the middle', () => {
    expect(getQuarterShapes(pond, 2, 2, 'water')).toEqual(shapes('full', 'full', 'full', 'full'));
  });

  it('puts an inside corner where only the diagonal is land', () => {
    const grid = parseTerrainMap(['.~', '~~']);
    expect(getQuarterShapes(grid, 1, 1, 'water')).toEqual(shapes('inner', 'full', 'full', 'full'));
  });

  it('draws a lone cell as four outer corners', () => {
    const grid = parseTerrainMap(['...', '.~.', '...']);
    expect(getQuarterShapes(grid, 1, 1, 'water')).toEqual(shapes('outer', 'outer', 'outer', 'outer'));
  });

  it('draws a one-wide channel with both banks', () => {
    const grid = parseTerrainMap(['.~.', '.~.', '.~.']);
    expect(getQuarterShapes(grid, 1, 1, 'water')).toEqual(shapes('vertical', 'vertical', 'vertical', 'vertical'));
  });

  it('treats cells past the map edge as the nearest cell on it', () => {
    const grid = parseTerrainMap(['~~', '~.']);
    // Top-left cell: everything off the map is water, only the diagonal is land.
    expect(getQuarterShapes(grid, 0, 0, 'water')).toEqual(shapes('full', 'full', 'full', 'inner'));
    // Top-right cell: the column below is land, the edge continues right.
    expect(getQuarterShapes(grid, 1, 0, 'water')).toEqual(shapes('full', 'full', 'horizontal', 'horizontal'));
  });
});

describe('getShapeTile', () => {
  const autotile: Autotile = { block: [10, 20], inner: [5, 6] };

  it('takes outer corners from the corners of the block', () => {
    expect(getShapeTile(autotile, 'outer', 'top-left')).toEqual([10, 20]);
    expect(getShapeTile(autotile, 'outer', 'bottom-right')).toEqual([12, 22]);
  });

  it('takes edges from the middle of the block sides', () => {
    expect(getShapeTile(autotile, 'horizontal', 'top-right')).toEqual([11, 20]);
    expect(getShapeTile(autotile, 'horizontal', 'bottom-left')).toEqual([11, 22]);
    expect(getShapeTile(autotile, 'vertical', 'top-left')).toEqual([10, 21]);
    expect(getShapeTile(autotile, 'vertical', 'bottom-right')).toEqual([12, 21]);
  });

  it('takes open terrain from the middle and inside corners from the inner tile', () => {
    expect(getShapeTile(autotile, 'full', 'bottom-left')).toEqual([11, 21]);
    expect(getShapeTile(autotile, 'inner', 'top-right')).toEqual([5, 6]);
  });
});

describe('getQuarterFrames', () => {
  // A 4-tile-wide sheet cuts into 8 quarter frames per row.
  const autotile: Autotile = { block: [0, 0], inner: [3, 0], animation: { frames: 2, columnStride: 4, frameMs: 100 } };

  it('is null for a cell of other terrain', () => {
    const grid = parseTerrainMap(['.']);
    expect(getQuarterFrames(grid, 0, 0, 'water', autotile, 4)).toBeNull();
  });

  it('uses the matching quarter of the source tile', () => {
    const grid = parseTerrainMap(['~']);
    // Open water: every quarter from middle tile (1, 1), quarters (2..3, 2..3).
    expect(getQuarterFrames(grid, 0, 0, 'water', autotile, 4)).toEqual([2 * 8 + 2, 2 * 8 + 3, 3 * 8 + 2, 3 * 8 + 3]);
    const lone = parseTerrainMap(['...', '.~.', '...']);
    // Outer corners: the block's corner tiles (0,0) (2,0) (0,2) (2,2).
    expect(getQuarterFrames(lone, 1, 1, 'water', autotile, 4)).toEqual([0, 5, 5 * 8 + 0, 5 * 8 + 5]);
  });

  it('shifts along the sheet for later animation frames', () => {
    const grid = parseTerrainMap(['~']);
    const first = getQuarterFrames(grid, 0, 0, 'water', autotile, 4);
    expect(getQuarterFrames(grid, 0, 0, 'water', autotile, 4, 1)).toEqual(first!.map((frame) => frame + 8));
  });

  it('maps water onto the overworld sheet', () => {
    const grid = parseTerrainMap(['.~', '~~']);
    const quarterColumns = TERRAIN_SHEET.columns * 2;
    // Open-water quarters come from middle tile (5, 9); the inside corner
    // from tile (2, 9)'s top-left quarter.
    expect(getQuarterFrames(grid, 1, 1, 'water', TERRAIN_AUTOTILES.water, TERRAIN_SHEET.columns)).toEqual([
      18 * quarterColumns + 4,
      18 * quarterColumns + 11,
      19 * quarterColumns + 10,
      19 * quarterColumns + 11,
    ]);
  });
});

describe('getTileFrame', () => {
  it('numbers sheet tiles row by row', () => {
    expect(getTileFrame([0, 0], 42)).toBe(0);
    expect(getTileFrame([3, 2], 42)).toBe(87);
  });

  it('points grass at a tile on the sheet', () => {
    const frame = getTileFrame(TERRAIN_BASE_TILE, TERRAIN_SHEET.columns);
    expect(frame).toBeGreaterThanOrEqual(0);
    expect(frame).toBeLessThan(TERRAIN_SHEET.columns * TERRAIN_SHEET.rows);
  });
});

describe('getQuarterFrameMap', () => {
  const autotile: Autotile = { block: [0, 0], inner: [3, 0], animation: { frames: 2, columnStride: 4, frameMs: 100 } };

  it('is twice the grid in each direction', () => {
    const grid = parseTerrainMap(['...', '...']);
    const map = getQuarterFrameMap(grid, 'water', autotile, 4);
    expect(map).toHaveLength(4);
    expect(map.every((row) => row.length === 6)).toBe(true);
  });

  it('is all empty (-1) when no cell holds the terrain', () => {
    const grid = parseTerrainMap(['..', '..']);
    expect(
      getQuarterFrameMap(grid, 'water', autotile, 4)
        .flat()
        .every((frame) => frame === -1),
    ).toBe(true);
  });

  it("lays each cell's quarters out in its own 2x2 block, in QUARTERS order", () => {
    const grid = parseTerrainMap(['...', '.~.', '...']);
    const map = getQuarterFrameMap(grid, 'water', autotile, 4);
    const [tl, tr, bl, br] = getQuarterFrames(grid, 1, 1, 'water', autotile, 4)!;
    expect(map[2].slice(2, 4)).toEqual([tl, tr]);
    expect(map[3].slice(2, 4)).toEqual([bl, br]);
    // Everything outside the water cell's block stays empty.
    const others = map.flatMap((row, y) => row.filter((_, x) => !(x >= 2 && x < 4 && y >= 2 && y < 4)));
    expect(others.every((frame) => frame === -1)).toBe(true);
  });

  it('agrees with getQuarterFrames for every cell', () => {
    const grid = parseTerrainMap(['.~~', '~~.', '.~.']);
    const map = getQuarterFrameMap(grid, 'water', autotile, 4);
    for (const { x, y } of grid.cells) {
      const quarters = getQuarterFrames(grid, x, y, 'water', autotile, 4) ?? [-1, -1, -1, -1];
      expect([map[y * 2][x * 2], map[y * 2][x * 2 + 1], map[y * 2 + 1][x * 2], map[y * 2 + 1][x * 2 + 1]]).toEqual(
        quarters,
      );
    }
  });

  it('uses the animation frame it is given', () => {
    const grid = parseTerrainMap(['~']);
    const first = getQuarterFrameMap(grid, 'water', autotile, 4);
    const second = getQuarterFrameMap(grid, 'water', autotile, 4, 1);
    expect(second).toEqual(first.map((row) => row.map((frame) => frame + 8)));
  });
});
