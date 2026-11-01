import { describe, expect, it } from 'vitest';
import { createBattleLevel, FIRST_STORY_CHAPTER } from '../battleSetup.ts';
import { planDeployment, planNextTurn, planUnitTurn } from './ai.ts';
import { applyCommand } from './commands.ts';
import { createBattleState } from './state.ts';
import { createTestBattle, makeTestUnit } from './testLevel.ts';

const duel = () =>
  createTestBattle({
    hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
    foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 4, y: 0 } },
  });

describe('planUnitTurn', () => {
  it('walks into reach and attacks', () => {
    expect(planUnitTurn(duel(), 'hero')).toEqual([
      {
        type: 'move',
        unitId: 'hero',
        to: { x: 3, y: 0 },
        path: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 3, y: 0 },
        ],
      },
      { type: 'attack', unitId: 'hero', target: { x: 4, y: 0 } },
    ]);
  });

  it('waits after walking when nobody is in reach', () => {
    const state = createTestBattle(
      {
        hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 9, y: 0 } },
      },
      { width: 10 },
    );
    expect(planUnitTurn(state, 'hero')[1]).toEqual({ type: 'wait', unitId: 'hero' });
  });

  it('goes after a Taunting foe while Taunted, over an easier one', () => {
    const taunted = makeTestUnit({ team: 'enemy' });
    const tank = makeTestUnit({ team: 'player', defense: 10 });
    const weak = makeTestUnit({ team: 'player', health: 1 });
    const state = createTestBattle(
      {
        foe: { unit: taunted, at: { x: 3, y: 0 } },
        weak: { unit: weak, at: { x: 2, y: 0 } },
        tank: { unit: tank, at: { x: 5, y: 0 } },
      },
      { width: 8 },
    );
    expect(planUnitTurn(state, 'foe')[1]).toEqual({ type: 'attack', unitId: 'foe', target: { x: 2, y: 0 } });
    taunted.statuses = ['taunted'];
    tank.statuses = ['taunting'];
    expect(planUnitTurn(state, 'foe')[1]).toEqual({ type: 'attack', unitId: 'foe', target: { x: 5, y: 0 } });
    tank.statuses = [];
    expect(planUnitTurn(state, 'foe')[1]).toEqual({ type: 'attack', unitId: 'foe', target: { x: 2, y: 0 } });
  });

  it('plans nothing for a unit not in play', () => {
    expect(planUnitTurn(duel(), 'nobody')).toEqual([]);
  });
});

// A battle where the hero has just felled a foe with Momentum and may move
// on (a canto), with a friend yet to act and a foe left.
function onCanto() {
  const hero = makeTestUnit({ team: 'player' });
  hero.modifiers = [{ kind: 'momentum', amount: 2 }];
  const start = createTestBattle({
    hero: { unit: hero, at: { x: 0, y: 0 } },
    foe: { unit: makeTestUnit({ team: 'enemy', health: 6 }), at: { x: 1, y: 0 } },
    friend: { unit: makeTestUnit({ team: 'player' }), at: { x: 5, y: 0 } },
    other: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 7, y: 0 } },
  });
  return applyCommand(start, { type: 'attack', unitId: 'hero', target: { x: 1, y: 0 } }).state;
}

describe('planNextTurn', () => {
  it('waits out a canto', () => {
    expect(planNextTurn(onCanto())).toEqual([{ type: 'wait', unitId: 'hero' }]);
  });

  it('plans for the phase team’s next unit that hasn’t acted', () => {
    const enemyPhase = applyCommand(duel(), { type: 'end-phase' }).state;
    expect(planNextTurn(enemyPhase)[0]).toMatchObject({ type: 'move', unitId: 'foe' });
  });

  it('plans nothing outside the battle', () => {
    expect(planNextTurn(duel()).length).toBe(2);
    expect(planNextTurn(createTestBattle({}, { started: false }))).toEqual([]);
  });
});

describe('planDeployment', () => {
  it('fills the zone in roster order up to the limit, then starts', () => {
    const state = createBattleState(createBattleLevel(FIRST_STORY_CHAPTER), 1);
    const commands = planDeployment(state);
    expect(commands).toHaveLength(state.deploymentLimit + 1);
    expect(commands[commands.length - 1]).toEqual({ type: 'start-battle' });
    const started = commands.reduce((s, command) => applyCommand(s, command).state, state);
    expect(started.deployed).toHaveLength(state.deploymentLimit);
  });
});
