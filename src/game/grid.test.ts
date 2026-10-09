import { describe, expect, it } from 'vitest';
import {
  createGrid,
  findTileAt,
  findUnit,
  getCornerTiles,
  getCell,
  getDistance,
  getNeighbors,
  gridToWorld,
  isInBounds,
  isSameTile,
  moveUnit,
  setTerrain,
  setUnit,
  worldToGrid,
  worldToTile,
} from './grid.ts';

describe('createGrid', () => {
  it('creates width x height cells with the given default terrain', () => {
    const grid = createGrid(3, 2, 'grass');
    expect(grid.width).toBe(3);
    expect(grid.height).toBe(2);
    expect(grid.cells).toHaveLength(6);
    expect(grid.cells.every((cell) => cell.terrain === 'grass')).toBe(true);
  });

  it('defaults unitId to null on every cell', () => {
    const grid = createGrid(2, 2);
    expect(grid.cells.every((cell) => cell.unitId === null)).toBe(true);
  });
});

describe('isInBounds', () => {
  const grid = createGrid(3, 2);

  it('is true for corners and interior points', () => {
    expect(isInBounds(grid, 0, 0)).toBe(true);
    expect(isInBounds(grid, 2, 1)).toBe(true);
  });

  it('is false outside the grid in any direction', () => {
    expect(isInBounds(grid, -1, 0)).toBe(false);
    expect(isInBounds(grid, 0, -1)).toBe(false);
    expect(isInBounds(grid, 3, 0)).toBe(false);
    expect(isInBounds(grid, 0, 2)).toBe(false);
  });
});

describe('getCell', () => {
  it('returns the cell at the given coordinates', () => {
    const grid = createGrid(3, 2, 'grass');
    expect(getCell(grid, 1, 1)).toEqual({ x: 1, y: 1, terrain: 'grass', unitId: null });
  });

  it('returns undefined out of bounds', () => {
    const grid = createGrid(3, 2);
    expect(getCell(grid, 5, 5)).toBeUndefined();
  });
});

describe('setTerrain', () => {
  it('returns a new grid with the terrain changed at that cell only', () => {
    const grid = createGrid(2, 2, 'grass');
    const next = setTerrain(grid, 1, 0, 'water');

    expect(getCell(next, 1, 0)!.terrain).toBe('water');
    expect(getCell(next, 0, 0)!.terrain).toBe('grass');
  });

  it('does not mutate the original grid', () => {
    const grid = createGrid(2, 2, 'grass');
    setTerrain(grid, 0, 0, 'water');

    expect(getCell(grid, 0, 0)!.terrain).toBe('grass');
  });

  it('throws for out-of-bounds coordinates', () => {
    const grid = createGrid(2, 2);
    expect(() => setTerrain(grid, 5, 5, 'water')).toThrow(RangeError);
  });
});

describe('setUnit', () => {
  it('places a unit id on a cell without disturbing its terrain', () => {
    const grid = createGrid(2, 2, 'grass');
    const next = setUnit(grid, 0, 1, 'unit-1');

    expect(getCell(next, 0, 1)).toEqual({ x: 0, y: 1, terrain: 'grass', unitId: 'unit-1' });
  });

  it('does not mutate the original grid', () => {
    const grid = createGrid(2, 2);
    setUnit(grid, 0, 0, 'unit-1');

    expect(getCell(grid, 0, 0)!.unitId).toBeNull();
  });

  it('throws for out-of-bounds coordinates', () => {
    const grid = createGrid(2, 2);
    expect(() => setUnit(grid, -1, 0, 'unit-1')).toThrow(RangeError);
  });
});

describe('moveUnit', () => {
  it('moves the unit id to the target cell and clears the source', () => {
    const grid = setUnit(createGrid(3, 3, 'grass'), 0, 0, 'unit-1');
    const next = moveUnit(grid, { x: 0, y: 0 }, { x: 2, y: 1 });

    expect(getCell(next, 0, 0)!.unitId).toBeNull();
    expect(getCell(next, 2, 1)).toEqual({ x: 2, y: 1, terrain: 'grass', unitId: 'unit-1' });
  });

  it('does not mutate the original grid', () => {
    const grid = setUnit(createGrid(3, 3), 0, 0, 'unit-1');
    moveUnit(grid, { x: 0, y: 0 }, { x: 1, y: 0 });

    expect(getCell(grid, 0, 0)!.unitId).toBe('unit-1');
    expect(getCell(grid, 1, 0)!.unitId).toBeNull();
  });

  it('returns the same grid when moving onto its own tile', () => {
    const grid = setUnit(createGrid(3, 3), 1, 1, 'unit-1');
    expect(moveUnit(grid, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(grid);
  });

  it('throws when there is no unit to move', () => {
    const grid = createGrid(3, 3);
    expect(() => moveUnit(grid, { x: 0, y: 0 }, { x: 1, y: 0 })).toThrow(/No unit/);
  });

  it('throws when the target is occupied', () => {
    let grid = setUnit(createGrid(3, 3), 0, 0, 'unit-1');
    grid = setUnit(grid, 1, 0, 'unit-2');
    expect(() => moveUnit(grid, { x: 0, y: 0 }, { x: 1, y: 0 })).toThrow(/occupied/);
  });

  it('throws when the target is out of bounds', () => {
    const grid = setUnit(createGrid(3, 3), 0, 0, 'unit-1');
    expect(() => moveUnit(grid, { x: 0, y: 0 }, { x: 5, y: 0 })).toThrow(RangeError);
  });
});

describe('getNeighbors', () => {
  it('returns all four neighbors for an interior cell', () => {
    const grid = createGrid(3, 3);
    const neighbors = getNeighbors(grid, 1, 1);

    expect(neighbors).toEqual(
      expect.arrayContaining([
        { x: 1, y: 0 },
        { x: 2, y: 1 },
        { x: 1, y: 2 },
        { x: 0, y: 1 },
      ]),
    );
    expect(neighbors).toHaveLength(4);
  });

  it('excludes out-of-bounds neighbors at a corner', () => {
    const grid = createGrid(3, 3);
    const neighbors = getNeighbors(grid, 0, 0);

    expect(neighbors).toEqual(
      expect.arrayContaining([
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]),
    );
    expect(neighbors).toHaveLength(2);
  });

  it('does not include diagonal neighbors', () => {
    const grid = createGrid(3, 3);
    const neighbors = getNeighbors(grid, 1, 1);

    expect(neighbors).not.toEqual(expect.arrayContaining([{ x: 0, y: 0 }]));
  });
});

describe('gridToWorld / worldToGrid', () => {
  it('converts grid coordinates to top-left pixel coordinates', () => {
    expect(gridToWorld(2, 3, 16)).toEqual({ x: 32, y: 48 });
  });

  it('round-trips through worldToGrid', () => {
    const tileSize = 16;
    const cell = { x: 4, y: 7 };
    const world = gridToWorld(cell.x, cell.y, tileSize);

    expect(worldToGrid(world.x, world.y, tileSize)).toEqual(cell);
  });

  it('floors to the containing tile for points inside a cell', () => {
    expect(worldToGrid(25, 9, 16)).toEqual({ x: 1, y: 0 });
  });
});

describe('findUnit', () => {
  it('returns the tile a unit stands on', () => {
    const grid = setUnit(createGrid(3, 3), 2, 1, 'a');
    expect(findUnit(grid, 'a')).toEqual({ x: 2, y: 1 });
  });

  it('returns null for a unit not on the grid', () => {
    expect(findUnit(createGrid(3, 3), 'a')).toBeNull();
  });
});

describe('getCornerTiles', () => {
  const grid = createGrid(4, 3);

  it('walks the top row from the top-left', () => {
    expect(getCornerTiles(grid, 'top-left', 3)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  it('takes the last tiles in reading order from the bottom-right', () => {
    expect(getCornerTiles(grid, 'bottom-right', 3)).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]);
  });

  it('wraps onto the next row when count exceeds the width', () => {
    expect(getCornerTiles(grid, 'top-left', 5).at(-1)).toEqual({ x: 0, y: 1 });
    expect(getCornerTiles(grid, 'bottom-right', 5)[0]).toEqual({ x: 3, y: 1 });
  });

  it('clamps to the grid size and handles zero', () => {
    expect(getCornerTiles(grid, 'top-left', 100)).toHaveLength(12);
    expect(getCornerTiles(grid, 'bottom-right', 0)).toEqual([]);
    expect(getCornerTiles(grid, 'top-left', -2)).toEqual([]);
  });

  it('throws on an unknown corner', () => {
    // @ts-expect-error not a corner
    expect(() => getCornerTiles(grid, 'middle', 1)).toThrow();
  });
});

describe('worldToTile', () => {
  const grid = createGrid(3, 2);

  it('returns the tile under a pixel on the grid', () => {
    expect(worldToTile(grid, 0, 0, 32)).toEqual({ x: 0, y: 0 });
    expect(worldToTile(grid, 95, 63, 32)).toEqual({ x: 2, y: 1 });
  });

  it('is null past the right or bottom edge', () => {
    expect(worldToTile(grid, 96, 0, 32)).toBeNull();
    expect(worldToTile(grid, 0, 64, 32)).toBeNull();
  });

  it('is null left of or above the grid, even within a tile of it', () => {
    expect(worldToTile(grid, -1, 0, 32)).toBeNull();
    expect(worldToTile(grid, 0, -0.5, 32)).toBeNull();
  });
});

describe('getDistance', () => {
  it('is 0 from a tile to itself', () => {
    expect(getDistance({ x: 2, y: 3 }, { x: 2, y: 3 })).toBe(0);
  });

  it('is 1 for orthogonal neighbors and 2 for diagonal ones', () => {
    expect(getDistance({ x: 2, y: 2 }, { x: 3, y: 2 })).toBe(1);
    expect(getDistance({ x: 2, y: 2 }, { x: 2, y: 1 })).toBe(1);
    expect(getDistance({ x: 2, y: 2 }, { x: 3, y: 3 })).toBe(2);
  });

  it('sums both axes and is symmetric', () => {
    expect(getDistance({ x: 0, y: 0 }, { x: 4, y: 3 })).toBe(7);
    expect(getDistance({ x: 4, y: 3 }, { x: 0, y: 0 })).toBe(7);
  });

  it('works for points off the grid', () => {
    expect(getDistance({ x: -1, y: -1 }, { x: 1, y: 1 })).toBe(4);
  });
});

describe('isSameTile', () => {
  it('compares only x and y', () => {
    expect(isSameTile({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(isSameTile({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
    const withExtras = { x: 1, y: 2, cost: 3 };
    expect(isSameTile(withExtras, { x: 1, y: 2 })).toBe(true);
  });
});

describe('findTileAt', () => {
  const targets = [
    { x: 1, y: 0, unitId: 'a' },
    { x: 0, y: 1, unitId: 'b' },
    { x: 0, y: 1, unitId: 'c' },
  ];

  it('returns the entry on that tile, keeping its extra fields', () => {
    expect(findTileAt(targets, { x: 1, y: 0 })).toEqual({ x: 1, y: 0, unitId: 'a' });
  });

  it('returns the first entry when several share a tile', () => {
    expect(findTileAt(targets, { x: 0, y: 1 })?.unitId).toBe('b');
  });

  it('is null when no entry is on the tile, or the list is empty', () => {
    expect(findTileAt(targets, { x: 1, y: 1 })).toBeNull();
    expect(findTileAt([], { x: 0, y: 0 })).toBeNull();
  });
});
