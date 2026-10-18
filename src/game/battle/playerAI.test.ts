import { describe, expect, it } from 'vitest';
import { createGrid, setUnit } from '../grid.ts';
import { HEAL_STAFF, staffEntry } from '../healing.ts';
import { HEALTH_POTION } from '../items.ts';
import { IRON_BOW, weaponEntry } from '../weapons.ts';
import { applyCommand, type BattleCommand } from './commands.ts';
import { planPlayerDeployment, planPlayerTurn } from './playerAI.ts';
import { createBattleState } from './state.ts';
import { createTestBattle, makeTestUnit } from './testLevel.ts';

const act = (commands: BattleCommand[]) => commands[commands.length - 1];
const endTile = (commands: BattleCommand[]) => (commands[0].type === 'move' ? commands[0].to : null);

describe('planPlayerTurn', () => {
  it('walks into reach and attacks', () => {
    const state = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 3, y: 0 } },
    });
    const plan = planPlayerTurn(state);
    expect(endTile(plan)).toEqual({ x: 2, y: 0 });
    expect(act(plan)).toEqual({ type: 'attack', unitId: 'hero', target: { x: 3, y: 0 } });
  });

  it('goes for the kill over a sturdier foe', () => {
    const state = createTestBattle(
      {
        hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 1, y: 1 } },
        tough: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 1, y: 0 } },
        weak: { unit: makeTestUnit({ team: 'enemy', health: 4 }), at: { x: 1, y: 2 } },
      },
      { width: 3, height: 3 },
    );
    expect(act(planPlayerTurn(state))).toMatchObject({ type: 'attack', target: { x: 1, y: 2 } });
  });

  it('stops short of a foe it cannot reach rather than walk into its reach', () => {
    const state = createTestBattle(
      {
        hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 7, y: 0 } },
      },
      { width: 10 },
    );
    const plan = planPlayerTurn(state);
    // The foe moves 3 and strikes 1 further: tiles 3 and up are in its reach.
    expect(endTile(plan)!.x).toBeLessThan(3);
    expect(endTile(plan)!.x).toBeGreaterThan(0);
    expect(act(plan)).toEqual({ type: 'wait', unitId: 'hero' });
  });

  it('ends its move on the seize tile when it can, over a fight', () => {
    const state = createTestBattle(
      {
        hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy', health: 1 }), at: { x: 1, y: 0 } },
      },
      { width: 6, height: 2, objective: { kind: 'seize', tile: { x: 0, y: 1 } } },
    );
    expect(endTile(planPlayerTurn(state))).toEqual({ x: 0, y: 1 });
  });

  it('heals a wounded ally with a staff', () => {
    const healer = makeTestUnit({ team: 'player', weaponTypes: [], items: [staffEntry(HEAL_STAFF)], magic: 3 });
    const hurt = makeTestUnit({ team: 'player', health: 20 });
    hurt.takeDamage(12);
    const state = createTestBattle(
      {
        healer: { unit: healer, at: { x: 0, y: 0 } },
        hurt: { unit: hurt, at: { x: 2, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 11, y: 0 } },
      },
      { width: 12 },
    );
    const plan = planPlayerTurn(state);
    expect(act(plan)).toMatchObject({ type: 'heal', unitId: 'healer', staffIndex: 0, target: { x: 2, y: 0 } });
    expect(() => plan.reduce((current, command) => applyCommand(current, command).state, state)).not.toThrow();
  });

  it('drinks a potion when badly hurt and nothing is in reach', () => {
    const hero = makeTestUnit({ team: 'player', items: [{ item: HEALTH_POTION, quantity: 1 }] });
    hero.takeDamage(15);
    const state = createTestBattle(
      {
        hero: { unit: hero, at: { x: 0, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 11, y: 0 } },
      },
      { width: 12 },
    );
    expect(act(planPlayerTurn(state))).toEqual({ type: 'item', unitId: 'hero', itemId: HEALTH_POTION.id });
  });

  it('plans nothing outside the player phase', () => {
    const state = createTestBattle(
      { hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } } },
      {
        started: false,
      },
    );
    expect(planPlayerTurn(state)).toEqual([]);
  });
});

describe('planPlayerDeployment', () => {
  it('fields the healthiest units, close fighters nearest the enemy, then starts', () => {
    const archer = makeTestUnit({ team: 'player', items: [weaponEntry(IRON_BOW)] });
    const fighter = makeTestUnit({ team: 'player' });
    const hurt = makeTestUnit({ team: 'player' });
    hurt.takeDamage(15);
    let grid = createGrid(6, 1, 'grass');
    grid = setUnit(grid, 5, 0, 'foe');
    const state = createBattleState(
      {
        grid,
        units: new Map([
          ['archer', archer],
          ['hurt', hurt],
          ['fighter', fighter],
          ['foe', makeTestUnit({ team: 'enemy' })],
        ]),
        roster: ['archer', 'hurt', 'fighter'],
        deploymentZone: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
        maxDeployed: 2,
      },
      1,
    );
    expect(planPlayerDeployment(state)).toEqual([
      { type: 'place', unitId: 'fighter', to: { x: 2, y: 0 } },
      { type: 'place', unitId: 'archer', to: { x: 1, y: 0 } },
      { type: 'start-battle' },
    ]);
  });
});
