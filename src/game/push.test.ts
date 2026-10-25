import { describe, expect, it } from 'vitest';
import { createGrid, setTerrain, setUnit, type Grid } from './grid.ts';
import { HAZARDS, SPIKES } from './hazards.ts';
import { BUMP_DAMAGE, getPushDirection, getPushResult, type Pushable } from './push.ts';

const EAST = { x: 1, y: 0 };

// A 4x3 grass grid with the foe in the middle of the west column but one.
function field(edit: (grid: Grid) => Grid = (grid) => grid): Grid {
  return edit(setUnit(createGrid(4, 3, 'grass'), 1, 1, 'foe'));
}

const units = new Map<string, Pushable>([
  ['foe', {}],
  ['other', {}],
  ['boss', { holdsPosition: true }],
]);

describe('getPushDirection', () => {
  it('points one step from the shover toward the shoved', () => {
    expect(getPushDirection({ x: 0, y: 1 }, { x: 1, y: 1 })).toEqual({ x: 1, y: 0 });
    expect(getPushDirection({ x: 1, y: 2 }, { x: 1, y: 1 })).toEqual({ x: 0, y: -1 });
    expect(getPushDirection({ x: 3, y: 0 }, { x: 0, y: 1 })).toEqual({ x: -1, y: 0 });
  });

  it('is no direction for the same tile', () => {
    expect(getPushDirection({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual({ x: 0, y: 0 });
  });
});

describe('getPushResult', () => {
  it('slides the unit onto an open tile, unhurt', () => {
    const result = getPushResult(field(), units, { x: 1, y: 1 }, EAST)!;
    expect(result).toMatchObject({ unitId: 'foe', to: { x: 2, y: 1 }, moved: true, blocked: null, damage: 0 });
    expect(result.drowned).toBe(false);
  });

  it('is null with no unit on the tile', () => {
    expect(getPushResult(field(), units, { x: 0, y: 0 }, EAST)).toBeNull();
  });

  it('bumps a unit against the edge of the map', () => {
    const grid = setUnit(createGrid(2, 1, 'grass'), 1, 0, 'foe');
    expect(getPushResult(grid, units, { x: 1, y: 0 }, EAST)).toMatchObject({
      to: { x: 1, y: 0 },
      moved: false,
      blocked: 'edge',
      damage: BUMP_DAMAGE,
      collidedId: null,
    });
  });

  it('bumps a unit against a wall or a mountain', () => {
    for (const terrain of ['wall', 'mountain']) {
      const grid = field((g) => setTerrain(g, 2, 1, terrain));
      expect(getPushResult(grid, units, { x: 1, y: 1 }, EAST)).toMatchObject({
        moved: false,
        blocked: 'terrain',
        damage: BUMP_DAMAGE,
      });
    }
  });

  it('slams a unit into the one behind it, hurting both', () => {
    const grid = field((g) => setUnit(g, 2, 1, 'other'));
    expect(getPushResult(grid, units, { x: 1, y: 1 }, EAST)).toMatchObject({
      moved: false,
      blocked: 'unit',
      damage: BUMP_DAMAGE,
      collidedId: 'other',
      collisionDamage: BUMP_DAMAGE,
    });
  });

  it('impales a unit shoved onto spikes', () => {
    const grid = field((g) => setTerrain(g, 2, 1, SPIKES));
    expect(getPushResult(grid, units, { x: 1, y: 1 }, EAST)).toMatchObject({
      to: { x: 2, y: 1 },
      moved: true,
      damage: HAZARDS[SPIKES].damage,
      hazard: HAZARDS[SPIKES],
      drowned: false,
    });
  });

  it('drowns a unit shoved into deep water, but not into a ford', () => {
    const water = field((g) => setTerrain(g, 2, 1, 'water'));
    expect(getPushResult(water, units, { x: 1, y: 1 }, EAST)).toMatchObject({
      to: { x: 2, y: 1 },
      moved: true,
      drowned: true,
    });
    const ford = field((g) => setTerrain(g, 2, 1, 'ford'));
    expect(getPushResult(ford, units, { x: 1, y: 1 }, EAST)).toMatchObject({ moved: true, drowned: false, damage: 0 });
  });

  it("can't move a unit that holds its ground", () => {
    const grid = setUnit(field(), 1, 1, 'boss');
    expect(getPushResult(grid, units, { x: 1, y: 1 }, EAST)).toMatchObject({
      unitId: 'boss',
      moved: false,
      blocked: 'steadfast',
      damage: 0,
    });
  });

  it('bumps a unit pushed nowhere in place', () => {
    expect(getPushResult(field(), units, { x: 1, y: 1 }, { x: 0, y: 0 })).toMatchObject({
      moved: false,
      blocked: 'edge',
    });
  });
});
