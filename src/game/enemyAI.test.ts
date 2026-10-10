import { describe, expect, it } from 'vitest';
import { planRushAction, type AttackScorer } from './enemyAI.ts';
import { createGrid, setTerrain, setUnit, type Grid, type Point } from './grid.ts';
import { FIRE, IRON_BOW, IRON_SPEAR } from './weapons.ts';

// Units are keyed by id; ids starting with 'p' are the player's, 'e' the enemy's.
const isHostile = (unitId: string) => unitId.startsWith('p');
const options = { canPassThrough: (unitId: string) => unitId.startsWith('e') };
const soldier = { movement: 3, weapon: IRON_SPEAR };

function place(grid: Grid, units: Record<string, Point>): Grid {
  return Object.entries(units).reduce((g, [unitId, { x, y }]) => setUnit(g, x, y, unitId), grid);
}

const last = (path: Point[]) => path[path.length - 1];

describe('planRushAction', () => {
  it('stays put and attacks a foe that is already adjacent', () => {
    const grid = place(createGrid(6, 6, 'grass'), { e1: { x: 2, y: 2 }, p1: { x: 3, y: 2 } });
    expect(planRushAction(grid, { x: 2, y: 2 }, soldier, isHostile, options)).toEqual({
      path: [{ x: 2, y: 2 }],
      target: { x: 3, y: 2, unitId: 'p1' },
    });
  });

  it('moves next to a foe in reach and attacks it', () => {
    const grid = place(createGrid(8, 1, 'grass'), { e1: { x: 0, y: 0 }, p1: { x: 4, y: 0 } });
    const { path, target } = planRushAction(grid, { x: 0, y: 0 }, soldier, isHostile, options);
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    expect(target).toEqual({ x: 4, y: 0, unitId: 'p1' });
  });

  it('walks its full movement toward a foe out of reach, without attacking', () => {
    const grid = place(createGrid(10, 1, 'grass'), { e1: { x: 0, y: 0 }, p1: { x: 9, y: 0 } });
    const { path, target } = planRushAction(grid, { x: 0, y: 0 }, soldier, isHostile, options);
    expect(target).toBeNull();
    expect(path).toHaveLength(soldier.movement + 1);
    expect(last(path)).toEqual({ x: 3, y: 0 });
  });

  it('heads for the nearest foe by walking distance', () => {
    // p1 is closer as the crow flies but walled off by water; p2 is the real nearest.
    let grid = createGrid(9, 3, 'grass');
    for (let y = 0; y < 3; y++) grid = setTerrain(grid, 3, y, 'water');
    grid = place(grid, { e1: { x: 4, y: 1 }, p1: { x: 0, y: 1 }, p2: { x: 8, y: 1 } });
    const { path } = planRushAction(grid, { x: 4, y: 1 }, soldier, isHostile, options);
    expect(last(path).x).toBeGreaterThan(4);
  });

  it('routes around impassable terrain', () => {
    let grid = createGrid(5, 5, 'grass');
    for (let x = 0; x < 4; x++) grid = setTerrain(grid, x, 2, 'water');
    grid = place(grid, { e1: { x: 0, y: 0 }, p1: { x: 0, y: 4 } });
    const { path, target } = planRushAction(
      grid,
      { x: 0, y: 0 },
      { movement: 20, weapon: IRON_SPEAR },
      isHostile,
      options,
    );
    expect(path.filter(({ y }) => y === 2)).toEqual([{ x: 4, y: 2 }]);
    expect(target!.unitId).toBe('p1');
  });

  it('walks through allies but never stops on one', () => {
    // e2 stands exactly where e1's full move would end.
    const grid = place(createGrid(10, 1, 'grass'), {
      e1: { x: 0, y: 0 },
      e2: { x: 3, y: 0 },
      p1: { x: 9, y: 0 },
    });
    const { path, target } = planRushAction(grid, { x: 0, y: 0 }, soldier, isHostile, options);
    expect(target).toBeNull();
    expect(last(path)).toEqual({ x: 2, y: 0 });
  });

  it('attacks from past an ally when the ally is in the way', () => {
    const grid = place(createGrid(6, 1, 'grass'), {
      e1: { x: 0, y: 0 },
      e2: { x: 1, y: 0 },
      p1: { x: 3, y: 0 },
    });
    const { path, target } = planRushAction(grid, { x: 0, y: 0 }, soldier, isHostile, options);
    expect(last(path)).toEqual({ x: 2, y: 0 });
    expect(target?.unitId).toBe('p1');
  });

  it('picks the attack position that costs the least to reach', () => {
    const grid = place(createGrid(9, 1, 'grass'), {
      p1: { x: 0, y: 0 },
      e1: { x: 3, y: 0 },
      p2: { x: 7, y: 0 },
    });
    const { path, target } = planRushAction(grid, { x: 3, y: 0 }, soldier, isHostile, options);
    expect(path).toHaveLength(3);
    expect(target!.unitId).toBe('p1');
  });

  it('attacks the target the scorer rates highest, not the cheapest', () => {
    const grid = place(createGrid(9, 1, 'grass'), {
      p1: { x: 0, y: 0 },
      e1: { x: 3, y: 0 },
      p2: { x: 6, y: 0 },
    });
    const preferP2: AttackScorer = (_from, target) => (target.unitId === 'p2' ? 10 : 1);
    const { path, target } = planRushAction(grid, { x: 3, y: 0 }, soldier, isHostile, options, preferP2);
    expect(last(path)).toEqual({ x: 5, y: 0 });
    expect(target!.unitId).toBe('p2');
  });

  it('weighs every foe in reach of a tile, not just the first', () => {
    // From where e1 stands both p1 (left) and p2 (right) are adjacent.
    const grid = place(createGrid(5, 1, 'grass'), {
      p1: { x: 1, y: 0 },
      e1: { x: 2, y: 0 },
      p2: { x: 3, y: 0 },
    });
    const preferP2: AttackScorer = (_from, target) => (target.unitId === 'p2' ? 1 : 0);
    const { path, target } = planRushAction(grid, { x: 2, y: 0 }, soldier, isHostile, options, preferP2);
    expect(path).toEqual([{ x: 2, y: 0 }]);
    expect(target).toEqual({ x: 3, y: 0, unitId: 'p2' });
  });

  it('scores each tile, so it can pick where to strike from', () => {
    // Fire reaches p1 from 1 or 2 away; the scorer prefers striking from range.
    const grid = place(createGrid(8, 1, 'grass'), { e1: { x: 2, y: 0 }, p1: { x: 3, y: 0 } });
    const preferRange: AttackScorer = (from, target) => Math.abs(from.x - target.x);
    const { path, target } = planRushAction(
      grid,
      { x: 2, y: 0 },
      { movement: 3, weapon: FIRE },
      isHostile,
      options,
      preferRange,
    );
    expect(last(path)).toEqual({ x: 1, y: 0 });
    expect(target!.unitId).toBe('p1');
  });

  it('breaks score ties by the cheapest tile', () => {
    const grid = place(createGrid(9, 1, 'grass'), {
      p1: { x: 0, y: 0 },
      e1: { x: 3, y: 0 },
      p2: { x: 7, y: 0 },
    });
    const { path, target } = planRushAction(grid, { x: 3, y: 0 }, soldier, isHostile, options, () => 5);
    expect(path).toHaveLength(3);
    expect(target!.unitId).toBe('p1');
  });

  it('uses its range to attack from further away', () => {
    const grid = place(createGrid(8, 1, 'grass'), { e1: { x: 0, y: 0 }, p1: { x: 4, y: 0 } });
    const { path, target } = planRushAction(grid, { x: 0, y: 0 }, { movement: 3, weapon: FIRE }, isHostile, options);
    expect(last(path)).toEqual({ x: 2, y: 0 });
    expect(target!.unitId).toBe('p1');
  });

  it("keeps its weapon's minimum range, backing off to strike", () => {
    // A bow can't hit adjacent foes: from next to p1 it steps away to shoot.
    const grid = place(createGrid(8, 1, 'grass'), { e1: { x: 3, y: 0 }, p1: { x: 4, y: 0 } });
    const { path, target } = planRushAction(
      grid,
      { x: 3, y: 0 },
      { movement: 3, weapon: IRON_BOW },
      isHostile,
      options,
    );
    expect(last(path)).toEqual({ x: 2, y: 0 });
    expect(target!.unitId).toBe('p1');
  });

  it('never attacks or approaches without a weapon', () => {
    const grid = place(createGrid(6, 1, 'grass'), { e1: { x: 0, y: 0 }, p1: { x: 1, y: 0 } });
    expect(planRushAction(grid, { x: 0, y: 0 }, { movement: 3, weapon: null }, isHostile, options)).toEqual({
      path: [{ x: 0, y: 0 }],
      target: null,
    });
  });

  it('stays put with no target when there are no foes', () => {
    const grid = place(createGrid(4, 4, 'grass'), { e1: { x: 1, y: 1 } });
    expect(planRushAction(grid, { x: 1, y: 1 }, soldier, isHostile, options)).toEqual({
      path: [{ x: 1, y: 1 }],
      target: null,
    });
  });

  it('stays put when every foe is unreachable', () => {
    let grid = createGrid(5, 1, 'grass');
    grid = setTerrain(grid, 2, 0, 'water');
    grid = place(grid, { e1: { x: 0, y: 0 }, p1: { x: 4, y: 0 } });
    expect(planRushAction(grid, { x: 0, y: 0 }, soldier, isHostile, options)).toEqual({
      path: [{ x: 0, y: 0 }],
      target: null,
    });
  });

  it('stays put with zero movement and no adjacent foe', () => {
    const grid = place(createGrid(5, 1, 'grass'), { e1: { x: 0, y: 0 }, p1: { x: 4, y: 0 } });
    const { path, target } = planRushAction(
      grid,
      { x: 0, y: 0 },
      { movement: 0, weapon: IRON_SPEAR },
      isHostile,
      options,
    );
    expect(path).toEqual([{ x: 0, y: 0 }]);
    expect(target).toBeNull();
  });

  it('does not treat a foe blocking the only corridor as passable', () => {
    // p1 plugs the corridor; e1 should come up to attack it rather than path through.
    const grid = place(createGrid(6, 1, 'grass'), {
      e1: { x: 5, y: 0 },
      p1: { x: 2, y: 0 },
      p2: { x: 0, y: 0 },
    });
    const { path, target } = planRushAction(grid, { x: 5, y: 0 }, soldier, isHostile, options);
    expect(last(path)).toEqual({ x: 3, y: 0 });
    expect(target!.unitId).toBe('p1');
  });
});
