import { describe, expect, it } from 'vitest';
import {
  canPlaceUnit,
  canStartBattle,
  getDeploymentActions,
  getFirstOpenTile,
  isInZone,
  isPlaced,
  placeUnit,
} from './deployment.ts';
import { createGrid, findUnit, getCell, setUnit } from './grid.ts';

const zone = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
];

describe('getDeploymentActions', () => {
  it('lists Place Units then Start', () => {
    const actions = getDeploymentActions({ canStart: true });
    expect(actions.map((a) => a.id)).toEqual(['place-units', 'start']);
    expect(actions.map((a) => a.label)).toEqual(['Place Units', 'Start']);
  });

  it('disables Start until the battle can start', () => {
    expect(getDeploymentActions({ canStart: false })[1].disabled).toBe(true);
    expect(getDeploymentActions({ canStart: true })[1].disabled).toBe(false);
  });

  it('is frozen', () => {
    const actions = getDeploymentActions({ canStart: false });
    expect(Object.isFrozen(actions)).toBe(true);
    expect(actions.every(Object.isFrozen)).toBe(true);
  });
});

describe('isInZone', () => {
  it('matches only zone tiles', () => {
    expect(isInZone(zone, 1, 0)).toBe(true);
    expect(isInZone(zone, 3, 0)).toBe(false);
    expect(isInZone(zone, 0, 1)).toBe(false);
    expect(isInZone([], 0, 0)).toBe(false);
  });
});

describe('canPlaceUnit', () => {
  const grid = createGrid(4, 4);

  it('allows empty zone tiles', () => {
    expect(canPlaceUnit(grid, zone, 'a', 2, 0)).toBe(true);
  });

  it('rejects tiles outside the zone, even empty ones', () => {
    expect(canPlaceUnit(grid, zone, 'a', 3, 0)).toBe(false);
    expect(canPlaceUnit(grid, zone, 'a', 0, 1)).toBe(false);
  });

  it('rejects zone tiles held by another unit', () => {
    expect(canPlaceUnit(setUnit(grid, 1, 0, 'b'), zone, 'a', 1, 0)).toBe(false);
  });

  it('allows the tile the unit already stands on', () => {
    expect(canPlaceUnit(setUnit(grid, 1, 0, 'a'), zone, 'a', 1, 0)).toBe(true);
  });

  it('rejects zone tiles outside the grid', () => {
    expect(canPlaceUnit(grid, [{ x: 9, y: 9 }], 'a', 9, 9)).toBe(false);
  });
});

describe('placeUnit', () => {
  const grid = createGrid(4, 4);

  it('puts an unplaced unit on the tile', () => {
    const placed = placeUnit(grid, zone, 'a', 1, 0);
    expect(getCell(placed, 1, 0)!.unitId).toBe('a');
    expect(getCell(grid, 1, 0)!.unitId).toBeNull();
  });

  it('moves an already placed unit, leaving its old tile empty', () => {
    const once = placeUnit(grid, zone, 'a', 0, 0);
    const twice = placeUnit(once, zone, 'a', 2, 0);
    expect(findUnit(twice, 'a')).toEqual({ x: 2, y: 0 });
    expect(getCell(twice, 0, 0)!.unitId).toBeNull();
  });

  it('returns the same grid when placed on its current tile', () => {
    const once = placeUnit(grid, zone, 'a', 0, 0);
    expect(placeUnit(once, zone, 'a', 0, 0)).toBe(once);
  });

  it('throws on an invalid tile', () => {
    expect(() => placeUnit(grid, zone, 'a', 3, 3)).toThrow();
    expect(() => placeUnit(setUnit(grid, 0, 0, 'b'), zone, 'a', 0, 0)).toThrow();
  });
});

describe('isPlaced / canStartBattle', () => {
  const grid = createGrid(4, 4);

  it('is false before any roster unit is placed', () => {
    expect(isPlaced(grid, 'a')).toBe(false);
    expect(canStartBattle(grid, ['a'])).toBe(false);
  });

  it('ignores units that are not in the roster', () => {
    expect(canStartBattle(setUnit(grid, 3, 3, 'enemy'), ['a'])).toBe(false);
  });

  it('is true once one roster unit is placed', () => {
    const placed = setUnit(grid, 0, 0, 'a');
    expect(isPlaced(placed, 'a')).toBe(true);
    expect(canStartBattle(placed, ['a', 'b'])).toBe(true);
  });

  it('is false for an empty roster', () => {
    expect(canStartBattle(grid, [])).toBe(false);
  });
});

describe('getFirstOpenTile', () => {
  const grid = createGrid(4, 4);

  it('returns the first empty zone tile', () => {
    expect(getFirstOpenTile(grid, zone)).toEqual({ x: 0, y: 0 });
    expect(getFirstOpenTile(setUnit(grid, 0, 0, 'a'), zone)).toEqual({ x: 1, y: 0 });
  });

  it('returns null when the zone is full or empty', () => {
    let full = grid;
    for (const { x, y } of zone) full = setUnit(full, x, y, `u${x}`);
    expect(getFirstOpenTile(full, zone)).toBeNull();
    expect(getFirstOpenTile(grid, [])).toBeNull();
  });
});
