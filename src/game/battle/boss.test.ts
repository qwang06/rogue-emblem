import { describe, expect, it } from 'vitest';
import { ORC_WARLORD } from '../bosses.ts';
import { getPhaseMovement } from '../enemyAI.ts';
import { findUnit } from '../grid.ts';
import type { Objective } from '../objectives.ts';
import { createBattle } from './runner.ts';
import { planNextTurn } from './ai.ts';
import { applyCommand, type BattleCommand, type BattleEvent } from './commands.ts';
import type { BattleState } from './state.ts';
import { createTestBattle, makeTestUnit } from './testLevel.ts';

function run(state: BattleState, ...commands: BattleCommand[]) {
  const events: BattleEvent[] = [];
  for (const command of commands) {
    const result = applyCommand(state, command);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

// Ends the player's phase and plays the enemy's out, back to the player.
function passTurn(state: BattleState) {
  let { state: next, events } = run(state, { type: 'end-phase' });
  while (next.turnState?.team === 'enemy' && !next.outcome) {
    const result = run(next, ...planNextTurn(next));
    next = result.state;
    events = [...events, ...result.events];
  }
  return { state: next, events };
}

const WARLORD: Objective = { kind: 'boss', unitId: 'boss', name: 'Orc Warlord' };

// A hero at the west end of an 8x3 field and the Warlord holding the east
// end's middle, out of each other's reach.
function hold({ bossHealth = 20, heroAt = { x: 0, y: 1 }, objective = WARLORD } = {}) {
  const boss = makeTestUnit({ team: 'enemy', name: 'Orc Warlord', health: bossHealth });
  boss.holdsPosition = true;
  return createTestBattle(
    {
      hero: { unit: makeTestUnit({ team: 'player' }), at: heroAt },
      boss: { unit: boss, at: { x: 7, y: 1 } },
    },
    { width: 8, height: 3, objective },
  );
}

const ofType = <T extends BattleEvent['type']>(events: readonly BattleEvent[], type: T) =>
  events.filter((event): event is Extract<BattleEvent, { type: T }> => event.type === type);

describe("the Warlord's Hold", () => {
  it("fights the run's final stage by the Warlord's rules", () => {
    const state = createBattle({ mode: 'warband', seed: 7, stage: 10 }, 7);
    expect(state.objective).toMatchObject({ kind: 'boss', name: 'Orc Warlord' });
    expect(state.boss).toMatchObject({ rulesId: ORC_WARLORD.id, enraged: false, incoming: null, called: 0 });
    expect(state.boss!.unitId).toBe(state.objective.kind === 'boss' ? state.objective.unitId : null);
  });
});

describe("the Warlord's war horn", () => {
  it('marks the tile beside him on the first enemy phase', () => {
    const { state, events } = passTurn(hold());
    expect(ofType(events, 'war-horn')).toEqual([{ type: 'war-horn', unitId: 'boss', at: { x: 7, y: 0 } }]);
    expect(state.boss).toMatchObject({ incoming: { x: 7, y: 0 }, called: 0 });
  });

  it('brings a goblin to the marked tile on the next enemy phase, done for that phase', () => {
    const { state: first } = passTurn(hold());
    const { events: arriving } = run(first, { type: 'end-phase' });
    expect(ofType(arriving, 'reinforced')).toEqual([{ type: 'reinforced', unitId: 'horn-1', at: { x: 7, y: 0 } }]);
    const { state } = passTurn(first);
    const goblin = state.units.get('horn-1') ?? state.fallen.get('horn-1');
    expect(goblin).toMatchObject({ unitClass: 'goblin', team: 'enemy', level: ORC_WARLORD.horn!.level });
    // It arrived done, so it stood its ground on the phase it came.
    expect(findUnit(state.grid, 'horn-1')).toEqual({ x: 7, y: 0 });
    expect(state.boss).toMatchObject({ incoming: null, called: 1 });
  });

  it('sounds again every other turn, up to its limit', () => {
    let state = hold({ heroAt: { x: 0, y: 0 } });
    const horns: number[] = [];
    for (let turn = 1; turn <= 9; turn++) {
      const result = passTurn(state);
      if (ofType(result.events, 'war-horn').length > 0) horns.push(turn);
      state = result.state;
      if (state.outcome) break;
    }
    expect(horns.length).toBeLessThanOrEqual(ORC_WARLORD.horn!.limit);
    expect(horns.slice(0, 2)).toEqual([1, 3]);
  });

  it('is blocked by a unit standing on the marked tile', () => {
    const { state: marked } = passTurn(hold({ heroAt: { x: 4, y: 0 } }));
    const { state: standing } = run(marked, { type: 'move', unitId: 'hero', to: { x: 7, y: 0 } });
    const { events } = run(standing, { type: 'wait', unitId: 'hero' });
    expect(ofType(events, 'reinforcement-blocked')).toEqual([
      { type: 'reinforcement-blocked', blockerId: 'hero', at: { x: 7, y: 0 } },
    ]);
    expect(ofType(events, 'reinforced')).toEqual([]);
  });

  it('stops once the Warlord falls', () => {
    const { state } = passTurn(hold());
    const fallen = { ...state, units: new Map([...state.units].filter(([unitId]) => unitId !== 'boss')) };
    const { events } = run(fallen as BattleState, { type: 'end-phase' });
    expect(ofType(events, 'reinforced')).toEqual([]);
  });

  it('never sounds for a boss without rules', () => {
    const { state, events } = passTurn(hold({ objective: { kind: 'boss', unitId: 'boss', name: 'Orc Chief' } }));
    expect(ofType(events, 'war-horn')).toEqual([]);
    expect(state.boss).toBeNull();
  });
});

describe("the Warlord's rage", () => {
  // The hero beside the Warlord: each of its hits takes 6 HP.
  const engaged = (bossHealth: number) => hold({ bossHealth, heroAt: { x: 6, y: 1 } });
  // The hero strikes, and the enemy's phase is skipped, back to the hero.
  const strike = (state: BattleState) => {
    const hit = run(state, { type: 'attack', unitId: 'hero', target: { x: 7, y: 1 } });
    if (hit.state.outcome) return hit;
    const skipped = run(hit.state, { type: 'end-phase' });
    return { state: skipped.state, events: [...hit.events, ...skipped.events] };
  };

  it('enrages at half health: +3 STR, and he leaves his post', () => {
    const before = engaged(12);
    const { state, events } = strike(before);
    expect(ofType(events, 'boss-enraged')).toEqual([
      { type: 'boss-enraged', unitId: 'boss', strength: ORC_WARLORD.enrage!.strength },
    ]);
    const boss = state.units.get('boss')!;
    expect(boss.strength).toBe(before.units.get('boss')!.strength + ORC_WARLORD.enrage!.strength);
    expect(boss.holdsPosition).toBe(false);
    expect(getPhaseMovement(boss)).toBe(boss.movement);
    expect(state.boss?.enraged).toBe(true);
    // The state before is untouched.
    expect(before.units.get('boss')!.holdsPosition).toBe(true);
  });

  it('stays calm above half health, and enrages only once', () => {
    const first = strike(engaged(24));
    expect(ofType(first.events, 'boss-enraged')).toEqual([]);
    expect(first.state.boss?.enraged).toBe(false);
    const second = strike(first.state);
    expect(ofType(second.events, 'boss-enraged')).toHaveLength(1);
    const third = strike(second.state);
    expect(third.state.units.get('boss')!.health).toBe(6);
    expect(ofType(third.events, 'boss-enraged')).toEqual([]);
  });

  it('wins the battle as usual when the blow fells him', () => {
    const { state, events } = strike(engaged(6));
    expect(state.outcome).toBe('victory');
    expect(ofType(events, 'boss-enraged')).toEqual([]);
  });
});
