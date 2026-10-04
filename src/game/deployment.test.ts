import { describe, expect, it } from 'vitest';
import {
  canDeployUnit,
  canPlaceUnit,
  canStartBattle,
  countPlaced,
  getDeploymentActions,
  getDeploymentLimit,
  getFirstOpenTile,
  isDeploymentComplete,
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

describe('countPlaced', () => {
  it('counts only roster units on the map', () => {
    const grid = setUnit(setUnit(createGrid(4, 4), 0, 0, 'a'), 1, 1, 'enemy');
    expect(countPlaced(grid, ['a', 'b'])).toBe(1);
    expect(countPlaced(grid, [])).toBe(0);
    expect(countPlaced(createGrid(4, 4), ['a', 'b'])).toBe(0);
  });
});

describe('getDeploymentLimit', () => {
  const roster = ['a', 'b', 'c'];

  it("uses the level's max when roster and zone have room", () => {
    expect(getDeploymentLimit(roster, zone, 2)).toBe(2);
  });

  it('is capped by the roster size', () => {
    expect(getDeploymentLimit(['a'], zone, 3)).toBe(1);
  });

  it('is capped by the zone size', () => {
    expect(getDeploymentLimit([...roster, 'd'], zone, 10)).toBe(3);
  });

  it('is zero with no roster, no zone, or a max of zero', () => {
    expect(getDeploymentLimit([], zone, 3)).toBe(0);
    expect(getDeploymentLimit(roster, [], 3)).toBe(0);
    expect(getDeploymentLimit(roster, zone, 0)).toBe(0);
    expect(getDeploymentLimit(roster, zone, -1)).toBe(0);
  });
});

describe('canDeployUnit', () => {
  const roster = ['a', 'b', 'c'];
  const onePlaced = setUnit(createGrid(4, 4), 0, 0, 'a');

  it('allows new units while slots are free', () => {
    expect(canDeployUnit(onePlaced, roster, 2, 'b')).toBe(true);
  });

  it('rejects new units once the limit is reached', () => {
    expect(canDeployUnit(setUnit(onePlaced, 1, 0, 'b'), roster, 2, 'c')).toBe(false);
    expect(canDeployUnit(createGrid(4, 4), roster, 0, 'a')).toBe(false);
  });

  it('always lets a placed unit move', () => {
    expect(canDeployUnit(setUnit(onePlaced, 1, 0, 'b'), roster, 2, 'a')).toBe(true);
    expect(canDeployUnit(onePlaced, roster, 1, 'a')).toBe(true);
  });
});

describe('isDeploymentComplete', () => {
  const roster = ['a', 'b', 'c'];
  const onePlaced = setUnit(createGrid(4, 4), 0, 0, 'a');

  it('is incomplete while slots are left', () => {
    expect(isDeploymentComplete(onePlaced, roster, 2)).toBe(false);
    expect(isDeploymentComplete(createGrid(4, 4), roster, 3)).toBe(false);
  });

  it('is complete once every slot is filled', () => {
    expect(isDeploymentComplete(onePlaced, roster, 1)).toBe(true);
    expect(isDeploymentComplete(setUnit(onePlaced, 1, 0, 'b'), roster, 2)).toBe(true);
  });

  it('is complete with no slots at all', () => {
    expect(isDeploymentComplete(createGrid(4, 4), roster, 0)).toBe(true);
  });
});
