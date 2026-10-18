import { describe, expect, it } from 'vitest';
import { findUnit } from '../grid.ts';
import { TURN_LIMIT } from '../objectives.ts';
import type { BattleCommand } from './commands.ts';
import { LOOKAHEAD, LOOKAHEAD_WEIGHTS, pickByLookahead, playOut, scorePlayOut } from './lookahead.ts';
import type { BattleState } from './state.ts';
import type { Unit } from '../Unit.ts';
import { createTestBattle, makeTestUnit } from './testLevel.ts';

const wait = (unitId: string, x: number): BattleCommand[] => [
  { type: 'move', unitId, to: { x, y: 0 } },
  { type: 'wait', unitId },
];

// A unit that misses often, so the dice decide what happens.
const unsure = (team: 'player' | 'enemy') => makeTestUnit({ team, skill: 0, speed: 0, luck: 0 });

// A unit that stays put on its phase, like a boss.
const holding = (unit: Unit): Unit => {
  unit.holdsPosition = true;
  return unit;
};

const withTurn = (state: BattleState, turn: number): BattleState => ({
  ...state,
  turnState: { ...state.turnState!, turn },
});

describe('playOut', () => {
  it('plays the action, then the enemy phase, and stops on the next player phase', () => {
    const state = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 3, y: 0 } },
    });
    const after = playOut(state, wait('hero', 0), 7);
    expect(after.turnState).toMatchObject({ turn: 2, team: 'player' });
    // The foe walked up and struck; the hero struck back.
    expect(findUnit(after.grid, 'foe')).toEqual({ x: 1, y: 0 });
    expect(after.units.get('hero')!.health).toBe(14);
    expect(after.units.get('foe')!.health).toBe(14);
    // The state it started from is untouched.
    expect(state.units.get('hero')!.health).toBe(20);
  });

  it('forfeits the rest of the player phase', () => {
    const state = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
      ally: { unit: makeTestUnit({ team: 'player' }), at: { x: 7, y: 0 } },
      foe: { unit: holding(makeTestUnit({ team: 'enemy' })), at: { x: 4, y: 0 } },
    });
    const after = playOut(state, wait('hero', 0), 7);
    expect(findUnit(after.grid, 'ally')).toEqual({ x: 7, y: 0 });
    expect(after.turnState).toMatchObject({ turn: 2, team: 'player' });
  });

  it('plays the rest of the player phase with the planner given', () => {
    const state = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
      ally: { unit: makeTestUnit({ team: 'player' }), at: { x: 7, y: 0 } },
      foe: { unit: holding(makeTestUnit({ team: 'enemy' })), at: { x: 4, y: 0 } },
    });
    let calls = 0;
    const allyAttacks = (): BattleCommand[] => {
      calls += 1;
      return [
        { type: 'move', unitId: 'ally', to: { x: 5, y: 0 } },
        { type: 'attack', unitId: 'ally', target: { x: 4, y: 0 } },
      ];
    };
    const after = playOut(state, wait('hero', 0), 7, allyAttacks);
    // Once for the ally's action; with everyone done, the phase ended.
    expect(calls).toBe(1);
    expect(findUnit(after.grid, 'ally')).toEqual({ x: 5, y: 0 });
    // Struck once on the player phase, struck back by the foe on its own.
    expect(after.units.get('foe')!.health).toBe(8);
    expect(after.turnState).toMatchObject({ turn: 2, team: 'player' });
  });

  it('stops once the battle is decided', () => {
    const state = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy', health: 6 }), at: { x: 1, y: 0 } },
    });
    const after = playOut(state, [{ type: 'attack', unitId: 'hero', target: { x: 1, y: 0 } }], 7);
    expect(after.outcome).toBe('victory');
  });

  it("rolls its own dice, never the battle's", () => {
    const units = () => ({
      hero: { unit: unsure('player'), at: { x: 0, y: 0 } },
      foe: { unit: unsure('enemy'), at: { x: 1, y: 0 } },
    });
    const attack: BattleCommand[] = [{ type: 'attack', unitId: 'hero', target: { x: 1, y: 0 } }];
    const health = (state: BattleState) => [...state.units.values()].map((unit) => unit.health);
    const results = [1, 2, 3, 4, 5].map((seed) => health(playOut(createTestBattle(units(), { seed }), attack, 7)));
    for (const result of results) expect(result).toEqual(results[0]);
  });
});

describe('scorePlayOut', () => {
  const start = () =>
    createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
      ally: { unit: makeTestUnit({ team: 'player' }), at: { x: 1, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 3, y: 0 } },
      other: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 5, y: 0 } },
    });

  it('counts damage dealt and taken, and units lost on each side', () => {
    const before = start();
    const after = start();
    after.units.get('foe')!.takeDamage(20);
    after.units.get('other')!.takeDamage(5);
    after.units.get('hero')!.takeDamage(20);
    after.units.get('ally')!.takeDamage(5);
    const W = LOOKAHEAD_WEIGHTS;
    expect(scorePlayOut(before, after)).toBeCloseTo(W.damageDealt * 25 + W.kill - W.damageTaken * 25 - W.fallen);
  });

  it('counts a heal as health won back', () => {
    const before = start();
    before.units.get('hero')!.takeDamage(10);
    const after = start();
    after.units.get('hero')!.takeDamage(4);
    expect(scorePlayOut(before, after)).toBeCloseTo(LOOKAHEAD_WEIGHTS.damageTaken * 6);
  });

  it('weighs damage to the boss extra', () => {
    const boss = () =>
      createTestBattle(
        {
          hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
          chief: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 3, y: 0 } },
        },
        { objective: { kind: 'boss', unitId: 'chief', name: 'Chief' } },
      );
    const after = boss();
    after.units.get('chief')!.takeDamage(5);
    const W = LOOKAHEAD_WEIGHTS;
    expect(scorePlayOut(boss(), after)).toBeCloseTo((W.damageDealt + W.bossDamage) * 5);
  });

  it('scores a decided battle by its outcome alone', () => {
    const before = start();
    expect(scorePlayOut(before, { ...before, outcome: 'victory' })).toBe(LOOKAHEAD_WEIGHTS.outcome);
    expect(scorePlayOut(before, { ...before, outcome: 'defeat' })).toBe(-LOOKAHEAD_WEIGHTS.outcome);
  });

  it('counts a drawn-out battle against the player, up to a loss by the turn limit', () => {
    const before = start();
    const { patience } = LOOKAHEAD;
    expect(scorePlayOut(before, withTurn(before, patience))).toBe(0);
    const late = scorePlayOut(before, withTurn(before, Math.floor((patience + TURN_LIMIT) / 2)));
    expect(late).toBeLessThan(0);
    expect(late).toBeGreaterThan(-LOOKAHEAD_WEIGHTS.outcome);
    expect(scorePlayOut(before, withTurn(before, TURN_LIMIT))).toBe(-LOOKAHEAD_WEIGHTS.outcome);
  });

  it('never presses a survive battle, which waiting wins', () => {
    const before = createTestBattle(
      {
        hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
        foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 7, y: 0 } },
      },
      { objective: { kind: 'survive', turns: TURN_LIMIT + 5 } },
    );
    expect(scorePlayOut(before, withTurn(before, TURN_LIMIT))).toBe(0);
  });
});

describe('pickByLookahead', () => {
  it('passes on an attack that leaves the foe alive to strike back for the kill', () => {
    // The hero's 6 damage can't fell the 20-health foe, whose counter
    // and next strike take the hero's 10 health; it stands still, so
    // stepping out of reach is safe.
    const state = createTestBattle(
      {
        hero: { unit: makeTestUnit({ team: 'player', health: 10 }), at: { x: 2, y: 0 } },
        foe: { unit: holding(makeTestUnit({ team: 'enemy' })), at: { x: 3, y: 0 } },
      },
      { width: 6 },
    );
    const attack = { commands: [{ type: 'attack', unitId: 'hero', target: { x: 3, y: 0 } }] as const, position: 0 };
    const retreat = { commands: wait('hero', 0), position: 0 };
    expect(pickByLookahead(state, [attack, retreat])).toBe(retreat);
  });

  it('takes the attack that wins the battle', () => {
    const state = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 2, y: 0 } },
      foe: { unit: holding(makeTestUnit({ team: 'enemy', health: 6 })), at: { x: 3, y: 0 } },
    });
    const retreat = { commands: wait('hero', 0), position: 5 };
    const attack = { commands: [{ type: 'attack', unitId: 'hero', target: { x: 3, y: 0 } }] as const, position: 0 };
    expect(pickByLookahead(state, [retreat, attack])).toBe(attack);
  });

  it("adds each candidate's position to its average, and keeps the first on a tie", () => {
    const state = createTestBattle(
      {
        hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
        foe: { unit: holding(makeTestUnit({ team: 'enemy' })), at: { x: 9, y: 0 } },
      },
      { width: 10 },
    );
    const stay = { commands: wait('hero', 0), position: 0 };
    const step = { commands: wait('hero', 1), position: 1 };
    expect(pickByLookahead(state, [stay, step])).toBe(step);
    expect(pickByLookahead(state, [stay, { ...step, position: 0 }])).toBe(stay);
  });

  it('needs a candidate', () => {
    const state = createTestBattle({ hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } } });
    expect(() => pickByLookahead(state, [])).toThrow();
  });
});
