import { describe, expect, it } from 'vitest';
import { calculateDamage, getAttackRange, getAttackTargets, getThreatRange } from './combat.js';
import { createGrid, setTerrain, setUnit } from './grid.js';

// Sorted "x,y" strings so assertions don't depend on iteration order.
function tiles(list) {
  return list.map(({ x, y }) => `${x},${y}`).sort();
}

describe('getAttackRange', () => {
  it('covers the four orthogonal neighbors at range 1', () => {
    const grid = createGrid(5, 5, 'grass');
    expect(tiles(getAttackRange(grid, { x: 2, y: 2 }, 1))).toEqual(['1,2', '2,1', '2,3', '3,2']);
  });

  it('never includes the attacker tile', () => {
    const grid = createGrid(5, 5, 'grass');
    expect(tiles(getAttackRange(grid, { x: 2, y: 2 }, 2))).not.toContain('2,2');
  });

  it('forms a diamond at range 2', () => {
    const grid = createGrid(5, 5, 'grass');
    const range = getAttackRange(grid, { x: 2, y: 2 }, 2);
    expect(range).toHaveLength(12);
    expect(tiles(range)).toContain('4,2');
    expect(tiles(range)).toContain('3,3');
    expect(tiles(range)).not.toContain('4,3');
  });

  it('respects a minimum range', () => {
    const grid = createGrid(5, 5, 'grass');
    const range = getAttackRange(grid, { x: 2, y: 2 }, 2, 2);
    expect(tiles(range)).toEqual(['0,2', '1,1', '1,3', '2,0', '2,4', '3,1', '3,3', '4,2']);
  });

  it('clips to the map edge', () => {
    const grid = createGrid(5, 5, 'grass');
    expect(tiles(getAttackRange(grid, { x: 0, y: 0 }, 1))).toEqual(['0,1', '1,0']);
  });

  it('is not blocked by impassable terrain', () => {
    let grid = createGrid(3, 1, 'grass');
    grid = setTerrain(grid, 1, 0, 'water');
    expect(tiles(getAttackRange(grid, { x: 0, y: 0 }, 1))).toEqual(['1,0']);
  });

  it('is empty with zero range', () => {
    const grid = createGrid(5, 5, 'grass');
    expect(getAttackRange(grid, { x: 2, y: 2 }, 0)).toEqual([]);
  });
});

describe('getThreatRange', () => {
  const sortTiles = (tiles) => [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);

  it('rings the stops with the tiles in attack range, leaving out the stops', () => {
    const grid = createGrid(5, 5);
    const stops = [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ];
    expect(sortTiles(getThreatRange(grid, stops, 1))).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 1, y: 2 },
      { x: 4, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ]);
  });

  it('lists each tile once even when several stops reach it', () => {
    const grid = createGrid(5, 5);
    const stops = [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
    ];
    const tiles = getThreatRange(grid, stops, 1);
    const keys = tiles.map(({ x, y }) => `${x},${y}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => k === '2,1')).toHaveLength(1);
  });

  it('reaches further with a longer range', () => {
    const grid = createGrid(5, 5);
    expect(getThreatRange(grid, [{ x: 2, y: 2 }], 2)).toHaveLength(12);
  });

  it('stays on the map', () => {
    const grid = createGrid(3, 3);
    expect(sortTiles(getThreatRange(grid, [{ x: 0, y: 0 }], 1))).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

  it('respects a minimum range', () => {
    const grid = createGrid(5, 5);
    const tiles = getThreatRange(grid, [{ x: 2, y: 2 }], 2, 2);
    expect(tiles).toHaveLength(8);
    expect(tiles).not.toContainEqual({ x: 2, y: 1 });
  });

  it('is empty with no stops', () => {
    expect(getThreatRange(createGrid(3, 3), [], 1)).toEqual([]);
  });
});

describe('getAttackTargets', () => {
  const isHostile = (unitId) => unitId.startsWith('enemy');

  it('returns hostile units in range', () => {
    let grid = createGrid(5, 5, 'grass');
    grid = setUnit(grid, 2, 2, 'hero');
    grid = setUnit(grid, 2, 3, 'enemy-a');
    expect(getAttackTargets(grid, { x: 2, y: 2 }, 1, isHostile)).toEqual([
      { x: 2, y: 3, unitId: 'enemy-a' },
    ]);
  });

  it('ignores allies and empty tiles', () => {
    let grid = createGrid(5, 5, 'grass');
    grid = setUnit(grid, 2, 2, 'hero');
    grid = setUnit(grid, 1, 2, 'ally');
    expect(getAttackTargets(grid, { x: 2, y: 2 }, 1, isHostile)).toEqual([]);
  });

  it('ignores hostile units out of range', () => {
    let grid = createGrid(5, 5, 'grass');
    grid = setUnit(grid, 2, 2, 'hero');
    grid = setUnit(grid, 4, 2, 'enemy-a');
    expect(getAttackTargets(grid, { x: 2, y: 2 }, 1, isHostile)).toEqual([]);
    expect(getAttackTargets(grid, { x: 2, y: 2 }, 2, isHostile)).toEqual([
      { x: 4, y: 2, unitId: 'enemy-a' },
    ]);
  });
});

describe('calculateDamage', () => {
  it('is attack minus defense', () => {
    expect(calculateDamage({ attack: 5 }, { defense: 2 })).toBe(3);
  });

  it('never goes below zero', () => {
    expect(calculateDamage({ attack: 1 }, { defense: 4 })).toBe(0);
  });
});
