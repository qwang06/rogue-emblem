import { describe, expect, it } from 'vitest';
import { createGrid, setTerrain, setUnit } from './grid.js';
import { getMoveCost, getMovementRange } from './movement.js';

// Sorted "x,y" strings so assertions don't depend on traversal order.
function tiles(range) {
  return range.map(({ x, y }) => `${x},${y}`).sort();
}

function find(range, x, y) {
  return range.find((t) => t.x === x && t.y === y);
}

describe('getMoveCost', () => {
  it('uses the terrain cost table', () => {
    expect(getMoveCost('grass')).toBe(1);
    expect(getMoveCost('water')).toBe(Infinity);
  });

  it('defaults unknown and null terrain to 1', () => {
    expect(getMoveCost('lava')).toBe(1);
    expect(getMoveCost(null)).toBe(1);
  });

  it('accepts a custom table', () => {
    expect(getMoveCost('forest', { forest: 2 })).toBe(2);
  });
});

describe('getMovementRange', () => {
  it('returns only the origin with zero movement', () => {
    const grid = createGrid(5, 5, 'grass');
    expect(getMovementRange(grid, { x: 2, y: 2 }, 0)).toEqual([{ x: 2, y: 2, cost: 0 }]);
  });

  it('reaches a diamond of orthogonal steps on open ground', () => {
    const grid = createGrid(5, 5, 'grass');
    const range = getMovementRange(grid, { x: 2, y: 2 }, 1);
    expect(tiles(range)).toEqual(['1,2', '2,1', '2,2', '2,3', '3,2']);
  });

  it('covers 2n(n+1)+1 tiles for movement n with room to spare', () => {
    const grid = createGrid(11, 11, 'grass');
    expect(getMovementRange(grid, { x: 5, y: 5 }, 3)).toHaveLength(25);
  });

  it('records the cheapest cost to each tile', () => {
    const grid = createGrid(5, 5, 'grass');
    const range = getMovementRange(grid, { x: 0, y: 0 }, 4);
    expect(find(range, 0, 0).cost).toBe(0);
    expect(find(range, 2, 2).cost).toBe(4);
  });

  it('is clipped at the map boundary', () => {
    const grid = createGrid(3, 3, 'grass');
    const range = getMovementRange(grid, { x: 0, y: 0 }, 1);
    expect(tiles(range)).toEqual(['0,0', '0,1', '1,0']);
  });

  it('never enters impassable terrain', () => {
    let grid = createGrid(5, 1, 'grass');
    grid = setTerrain(grid, 2, 0, 'water');
    const range = getMovementRange(grid, { x: 0, y: 0 }, 10);
    expect(tiles(range)).toEqual(['0,0', '1,0']);
  });

  it('routes around obstacles, spending the extra steps', () => {
    let grid = createGrid(3, 3, 'grass');
    grid = setTerrain(grid, 1, 0, 'water');
    grid = setTerrain(grid, 1, 1, 'water');
    // From (0,0) to (2,0) must go down around the water: 6 steps.
    expect(find(getMovementRange(grid, { x: 0, y: 0 }, 5), 2, 0)).toBeUndefined();
    expect(find(getMovementRange(grid, { x: 0, y: 0 }, 6), 2, 0).cost).toBe(6);
  });

  it('charges higher terrain costs', () => {
    let grid = createGrid(3, 1, 'grass');
    grid = setTerrain(grid, 1, 0, 'forest');
    const terrainCosts = { grass: 1, forest: 2 };
    expect(tiles(getMovementRange(grid, { x: 0, y: 0 }, 2, { terrainCosts }))).toEqual(['0,0', '1,0']);
    expect(find(getMovementRange(grid, { x: 0, y: 0 }, 3, { terrainCosts }), 2, 0).cost).toBe(3);
  });

  it('is blocked by other units by default', () => {
    let grid = createGrid(4, 1, 'grass');
    grid = setUnit(grid, 0, 0, 'mover');
    grid = setUnit(grid, 1, 0, 'enemy');
    expect(tiles(getMovementRange(grid, { x: 0, y: 0 }, 3))).toEqual(['0,0']);
  });

  it('passes through units canPassThrough allows, but never ends on them', () => {
    let grid = createGrid(4, 1, 'grass');
    grid = setUnit(grid, 0, 0, 'mover');
    grid = setUnit(grid, 1, 0, 'ally');
    const range = getMovementRange(grid, { x: 0, y: 0 }, 3, {
      canPassThrough: (id) => id === 'ally',
    });
    expect(tiles(range)).toEqual(['0,0', '2,0', '3,0']);
  });

  it('includes the origin even though the mover occupies it', () => {
    let grid = createGrid(3, 3, 'grass');
    grid = setUnit(grid, 1, 1, 'mover');
    expect(find(getMovementRange(grid, { x: 1, y: 1 }, 1), 1, 1)).toEqual({ x: 1, y: 1, cost: 0 });
  });

  it('returns nothing for an out-of-bounds origin', () => {
    const grid = createGrid(3, 3, 'grass');
    expect(getMovementRange(grid, { x: 5, y: 5 }, 3)).toEqual([]);
  });
});
