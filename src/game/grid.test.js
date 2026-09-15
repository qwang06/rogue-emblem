import { describe, expect, it } from 'vitest';
import {
  createGrid,
  getCell,
  getNeighbors,
  gridToWorld,
  isInBounds,
  setTerrain,
  setUnit,
  worldToGrid,
} from './grid.js';

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

    expect(getCell(next, 1, 0).terrain).toBe('water');
    expect(getCell(next, 0, 0).terrain).toBe('grass');
  });

  it('does not mutate the original grid', () => {
    const grid = createGrid(2, 2, 'grass');
    setTerrain(grid, 0, 0, 'water');

    expect(getCell(grid, 0, 0).terrain).toBe('grass');
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

    expect(getCell(grid, 0, 0).unitId).toBeNull();
  });

  it('throws for out-of-bounds coordinates', () => {
    const grid = createGrid(2, 2);
    expect(() => setUnit(grid, -1, 0, 'unit-1')).toThrow(RangeError);
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
