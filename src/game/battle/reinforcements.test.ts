import { describe, expect, it } from 'vitest';
import { createGrid, setTerrain, setUnit } from '../grid.ts';
import { applyCommand } from './commands.ts';
import {
  createArrival,
  createReinforcementState,
  createWaveArrival,
  getWaveUnitId,
  isWaveTurn,
  pickWaveTile,
  type ReinforcementRules,
} from './reinforcements.ts';
import type { BattleState } from './state.ts';
import { createTestBattle, makeTestUnit } from './testLevel.ts';

const RULES: ReinforcementRules = {
  level: 6,
  surgePercent: 150,
  waves: { every: 2, classes: ['goblin', 'slime'], limit: 2 },
};

describe('isWaveTurn', () => {
  it('is every `every`th turn, until the limit has arrived', () => {
    const state = createReinforcementState(RULES)!;
    expect([1, 2, 3, 4].map((turn) => isWaveTurn(state, turn))).toEqual([false, true, false, true]);
    expect(isWaveTurn({ ...state, arrived: 2 }, 4)).toBe(false);
    expect(isWaveTurn(createReinforcementState({ level: 1, surgePercent: 100 })!, 2)).toBe(false);
    expect(createReinforcementState(undefined)).toBeNull();
  });
});

describe('createArrival', () => {
  it('comes at least at the stage level, with its surge', () => {
    const plain = createArrival('goblin', 6, null);
    const arrival = createArrival('goblin', 2, RULES);
    expect(arrival.level).toBe(6);
    expect(arrival.team).toBe('enemy');
    expect(arrival.maxHealth).toBe(Math.round(plain.maxHealth * 1.5));
    expect(createArrival('goblin', 9, RULES).level).toBe(9);
  });

  it("sends the wave's classes in turn", () => {
    const state = createReinforcementState(RULES)!;
    expect(createWaveArrival(state).unitClass).toBe('goblin');
    expect(createWaveArrival({ ...state, arrived: 1 }).unitClass).toBe('slime');
    expect(getWaveUnitId(1)).toBe('wave-1');
  });
});

describe('pickWaveTile', () => {
  it('takes the free walkable tile farthest from the deployment zone, middle first', () => {
    let grid = createGrid(5, 4, 'grass');
    const zone = [{ x: 2, y: 3 }];
    expect(pickWaveTile(grid, zone)).toEqual({ x: 0, y: 0 });
    grid = setUnit(grid, 0, 0, 'blocker');
    expect(pickWaveTile(grid, zone)).toEqual({ x: 4, y: 0 });
    grid = setTerrain(grid, 4, 0, 'water');
    expect(pickWaveTile(grid, zone)).toEqual({ x: 1, y: 0 });
    expect(pickWaveTile(grid, [])).toBeNull();
  });

  it('stays within reach of the deployment zone on a big map', () => {
    const grid = createGrid(20, 4, 'grass');
    const zone = [{ x: 0, y: 3 }];
    // The farthest tiles within 10 steps are 10 away; of those, the
    // nearest the middle column, then the topmost, wins.
    expect(pickWaveTile(grid, zone, 10)).toEqual({ x: 9, y: 2 });
    expect(pickWaveTile(grid, zone, 100)).toEqual({ x: 19, y: 0 });
    // Nothing within reach: the nearest tile past it.
    const row = setUnit(createGrid(20, 1, 'grass'), 0, 0, 'hero');
    expect(pickWaveTile(row, [{ x: 0, y: 0 }], 0)).toEqual({ x: 1, y: 0 });
  });
});

describe('waves in battle', () => {
  it('brings an enemy to the far edge on every second enemy phase, done for that phase', () => {
    const base = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 3, y: 0 } },
    });
    let state: BattleState = {
      ...base,
      deploymentZone: [{ x: 0, y: 0 }],
      reinforcements: createReinforcementState(RULES),
    };
    const end = () => applyCommand(state, { type: 'end-phase' });
    state = end().state; // enemy, turn 1: nobody arrives
    expect(state.units.has('wave-1')).toBe(false);
    state = end().state; // player, turn 2
    const { state: next, events } = end(); // enemy, turn 2
    expect(events).toContainEqual({ type: 'reinforced', unitId: 'wave-1', at: { x: 7, y: 0 } });
    expect(next.units.get('wave-1')).toMatchObject({ unitClass: 'goblin', level: 6, team: 'enemy' });
    expect(next.turnState!.done).toContain('wave-1');
    expect(next.reinforcements!.arrived).toBe(1);
  });
});
