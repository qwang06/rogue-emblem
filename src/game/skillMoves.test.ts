import { describe, expect, it } from 'vitest';
import { createGrid, setTerrain, setUnit } from './grid.ts';
import { canStandOn, getLeapLanding, getRetreatTile, getStep, getStrafePath, isInLine } from './skillMoves.ts';

const open = (width = 6, height = 6) => createGrid(width, height, 'grass');

describe('canStandOn', () => {
  it('needs an in-bounds, empty, walkable tile, counting the mover as absent', () => {
    let grid = setUnit(open(), 1, 1, 'a');
    grid = setTerrain(grid, 2, 2, 'water');
    expect(canStandOn(grid, { x: 0, y: 0 })).toBe(true);
    expect(canStandOn(grid, { x: 1, y: 1 })).toBe(false);
    expect(canStandOn(grid, { x: 1, y: 1 }, 'a')).toBe(true);
    expect(canStandOn(grid, { x: 2, y: 2 })).toBe(false);
    expect(canStandOn(grid, { x: -1, y: 0 })).toBe(false);
  });
});

describe('getStep and isInLine', () => {
  it('steps along the longer axis, x on a tie', () => {
    expect(getStep({ x: 0, y: 0 }, { x: 3, y: 1 })).toEqual({ x: 1, y: 0 });
    expect(getStep({ x: 0, y: 0 }, { x: 1, y: -3 })).toEqual({ x: 0, y: -1 });
    expect(getStep({ x: 0, y: 0 }, { x: -2, y: 2 })).toEqual({ x: -1, y: 0 });
    expect(getStep({ x: 1, y: 1 }, { x: 1, y: 1 })).toBeNull();
    expect(isInLine({ x: 1, y: 0 }, { x: 1, y: 4 })).toBe(true);
    expect(isInLine({ x: 1, y: 0 }, { x: 2, y: 4 })).toBe(false);
  });
});

describe('getLeapLanding', () => {
  it('stays put next to the target', () => {
    const grid = setUnit(open(), 2, 2, 'me');
    expect(getLeapLanding(grid, 'me', { x: 2, y: 2 }, { x: 3, y: 2 }, 2)).toEqual({ x: 2, y: 2 });
  });

  it('lands on the free tile next to the target nearest the leaper', () => {
    let grid = setUnit(open(), 0, 0, 'me');
    grid = setUnit(grid, 3, 1, 'foe');
    expect(getLeapLanding(grid, 'me', { x: 0, y: 0 }, { x: 3, y: 1 }, 3)).toEqual({ x: 3, y: 0 });
    grid = setUnit(grid, 3, 0, 'other');
    expect(getLeapLanding(grid, 'me', { x: 0, y: 0 }, { x: 3, y: 1 }, 3)).toEqual({ x: 2, y: 1 });
    expect(getLeapLanding(grid, 'me', { x: 0, y: 0 }, { x: 3, y: 1 }, 2)).toBeNull();
  });

  it('charges only along a clear row or column', () => {
    let grid = setUnit(open(), 0, 0, 'me');
    expect(getLeapLanding(grid, 'me', { x: 0, y: 0 }, { x: 4, y: 0 }, 3, true)).toEqual({ x: 3, y: 0 });
    expect(getLeapLanding(grid, 'me', { x: 0, y: 0 }, { x: 5, y: 0 }, 3, true)).toBeNull();
    expect(getLeapLanding(grid, 'me', { x: 0, y: 0 }, { x: 3, y: 1 }, 3, true)).toBeNull();
    grid = setTerrain(grid, 2, 0, 'water');
    expect(getLeapLanding(grid, 'me', { x: 0, y: 0 }, { x: 4, y: 0 }, 3, true)).toBeNull();
  });
});

describe('getRetreatTile', () => {
  it('steps straight back from the target as far as free tiles allow', () => {
    let grid = setUnit(open(), 3, 2, 'me');
    expect(getRetreatTile(grid, 'me', { x: 3, y: 2 }, { x: 4, y: 2 }, 2)).toEqual({ x: 1, y: 2 });
    grid = setUnit(grid, 1, 2, 'other');
    expect(getRetreatTile(grid, 'me', { x: 3, y: 2 }, { x: 4, y: 2 }, 2)).toEqual({ x: 2, y: 2 });
    expect(getRetreatTile(grid, 'me', { x: 3, y: 2 }, { x: 3, y: 3 }, 2)).toEqual({ x: 3, y: 0 });
    expect(getRetreatTile(grid, 'me', { x: 3, y: 2 }, { x: 3, y: 1 }, 5)).toEqual({ x: 3, y: 5 });
  });
});

describe('getStrafePath', () => {
  it('flies to the farthest free tile in reach, over everything between', () => {
    let grid = setUnit(open(), 0, 0, 'me');
    grid = setUnit(grid, 1, 0, 'foe');
    grid = setUnit(grid, 3, 0, 'other');
    expect(getStrafePath(grid, 'me', { x: 0, y: 0 }, { x: 1, y: 0 }, 3)).toEqual({
      landing: { x: 2, y: 0 },
      passed: [{ x: 1, y: 0 }],
    });
  });

  it('is null off the line or with nowhere to land past the target', () => {
    let grid = setUnit(open(), 0, 0, 'me');
    expect(getStrafePath(grid, 'me', { x: 0, y: 0 }, { x: 1, y: 1 }, 3)).toBeNull();
    grid = setUnit(grid, 2, 0, 'foe');
    grid = setUnit(grid, 3, 0, 'other');
    expect(getStrafePath(grid, 'me', { x: 0, y: 0 }, { x: 2, y: 0 }, 3)).toBeNull();
  });
});
