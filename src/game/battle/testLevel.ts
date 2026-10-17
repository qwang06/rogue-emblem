// Small hand-built battles for the battle module's tests: a strip of open
// grass with units where the test puts them, already started (or still in
// deployment). Not used by the game itself.

import { createGrid, setUnit, type Point } from '../grid.ts';
import type { Objective } from '../objectives.ts';
import { Unit, type UnitOptions } from '../Unit.ts';
import { weaponEntry, IRON_SPEAR } from '../weapons.ts';
import { applyCommand } from './commands.ts';
import { createBattleState, type BattleState } from './state.ts';

// A unit whose strikes always land and never crit (its skill outdoes any
// avoid, its luck any crit), so exchanges come out the same whatever the
// dice. Iron spear, 5 strength: 6 damage a hit against 0 defense.
export function makeTestUnit(options: Partial<UnitOptions> & Pick<UnitOptions, 'team'>): Unit {
  return new Unit({
    name: options.team === 'player' ? 'Hero' : 'Foe',
    health: 20,
    strength: 5,
    skill: 100,
    luck: 100,
    defense: 0,
    movement: 3,
    weaponTypes: ['physical'],
    items: [weaponEntry(IRON_SPEAR)],
    ...options,
  });
}

export interface TestUnit {
  unit: Unit;
  at: Point;
}

// A `width` x `height` grass battle with `units` on the map (ids starting
// with the team don't matter: each unit's own team does), started on turn
// 1's player phase unless `started` is false.
export function createTestBattle(
  units: Record<string, TestUnit>,
  { width = 8, height = 1, objective, started = true, seed = 1 }: TestBattleOptions = {},
): BattleState {
  let grid = createGrid(width, height, 'grass');
  for (const [unitId, { at }] of Object.entries(units)) grid = setUnit(grid, at.x, at.y, unitId);
  const state = createBattleState(
    {
      grid,
      units: new Map(Object.entries(units).map(([unitId, { unit }]) => [unitId, unit])),
      roster: [],
      deploymentZone: [],
      maxDeployed: 0,
      objective,
    },
    seed,
  );
  return started ? applyCommand(state, { type: 'start-battle' }).state : state;
}

export interface TestBattleOptions {
  width?: number;
  height?: number;
  objective?: Objective;
  started?: boolean;
  seed?: number;
}
