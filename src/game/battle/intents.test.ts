import { describe, expect, it } from 'vitest';
import { findUnit } from '../grid.ts';
import { planNextTurn } from './ai.ts';
import { applyCommand } from './commands.ts';
import { getEnemyIntents, getIntentThreats } from './intents.ts';
import { createTestBattle, makeTestUnit } from './testLevel.ts';

describe('getEnemyIntents', () => {
  it("shows the foe's route to the hero and the strike it plans", () => {
    const state = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 4, y: 0 } },
    });
    const [intent] = getEnemyIntents(state);
    expect(intent).toMatchObject({
      unitId: 'foe',
      target: { x: 0, y: 0, unitId: 'hero' },
      damage: 6,
      strikes: 1,
      hit: 100,
    });
    expect(intent.path[0]).toEqual({ x: 4, y: 0 });
    expect(intent.path[intent.path.length - 1]).toEqual({ x: 1, y: 0 });
  });

  it('matches what the enemy phase then does', () => {
    const start = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 4, y: 0 } },
    });
    const [intent] = getEnemyIntents(start);
    const enemyPhase = applyCommand(start, { type: 'end-phase' }).state;
    const [move, act] = planNextTurn(enemyPhase);
    expect(move).toMatchObject({ type: 'move', to: intent.path[intent.path.length - 1] });
    expect(act).toMatchObject({ type: 'attack', target: { x: 0, y: 0 } });
  });

  it("plans each foe with those before it already moved, so they don't share a tile", () => {
    const state = createTestBattle(
      {
        hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
        first: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 3, y: 0 } },
        second: { unit: makeTestUnit({ team: 'enemy', movement: 6 }), at: { x: 5, y: 0 } },
      },
      { height: 2 },
    );
    const [first, second] = getEnemyIntents(state);
    const end = (path: readonly { x: number; y: number }[]) => path[path.length - 1];
    expect(end(first.path)).not.toEqual(end(second.path));
    expect(first.target?.unitId).toBe('hero');
    expect(second.target?.unitId).toBe('hero');
  });

  it('shows a foe that can reach no one only moving', () => {
    const state = createTestBattle(
      {
        hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy', movement: 2 }), at: { x: 11, y: 0 } },
      },
      { width: 12 },
    );
    const [intent] = getEnemyIntents(state);
    expect(intent).toMatchObject({ target: null, damage: 0, strikes: 0 });
    expect(intent.path[intent.path.length - 1]).toEqual({ x: 9, y: 0 });
  });

  it("doesn't move anyone on the real map", () => {
    const state = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 4, y: 0 } },
    });
    getEnemyIntents(state);
    expect(findUnit(state.grid, 'foe')).toEqual({ x: 4, y: 0 });
  });

  it('is empty before the battle starts', () => {
    const state = createTestBattle(
      { foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 4, y: 0 } } },
      { started: false },
    );
    expect(getEnemyIntents(state)).toEqual([]);
  });
});

describe('getIntentThreats', () => {
  it('adds up the strikes planned on each unit and says when they would fell it', () => {
    const state = createTestBattle(
      {
        hero: { unit: makeTestUnit({ team: 'player', health: 12 }), at: { x: 2, y: 0 } },
        left: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 0, y: 0 } },
        right: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 4, y: 0 } },
      },
      { width: 6 },
    );
    const threats = getIntentThreats(state, getEnemyIntents(state));
    expect(threats).toEqual([{ unitId: 'hero', at: { x: 2, y: 0 }, damage: 12, attackers: 2, lethal: true }]);
  });

  it('is empty when nobody is attacked', () => {
    const state = createTestBattle(
      {
        hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy', movement: 1 }), at: { x: 7, y: 0 } },
      },
      { width: 8 },
    );
    expect(getIntentThreats(state, getEnemyIntents(state))).toEqual([]);
  });
});
