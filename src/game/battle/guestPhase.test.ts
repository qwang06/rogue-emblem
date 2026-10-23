import { describe, expect, it } from 'vitest';
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

// A hero at the west end of an 8x1 strip, a guest ally beside the foe.
function withGuest({ guestHealth = 20, foeAt = 3 } = {}) {
  return createTestBattle({
    hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
    guest: { unit: makeTestUnit({ team: 'guest', name: 'Guest', health: guestHealth }), at: { x: 2, y: 0 } },
    foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: foeAt, y: 0 } },
  });
}

// Plays the AI's units until the phase changes.
function playPhase(state: BattleState) {
  const team = state.turnState!.team;
  const events: BattleEvent[] = [];
  while (state.turnState?.team === team && !state.outcome) {
    const result = run(state, ...planNextTurn(state));
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

describe('the guest phase', () => {
  it('comes after the enemy phase, and the next turn after it', () => {
    let state = withGuest();
    const phases: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      state = run(state, { type: 'end-phase' }).state;
      phases.push({ turn: state.turnState!.turn, team: state.turnState!.team });
    }
    expect(phases).toEqual([
      { turn: 1, team: 'enemy' },
      { turn: 1, team: 'guest' },
      { turn: 2, team: 'player' },
    ]);
  });

  it('is skipped when no guest is in play', () => {
    const state = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 6, y: 0 } },
    });
    const next = run(state, { type: 'end-phase' }, { type: 'end-phase' }).state;
    expect(next.turnState).toMatchObject({ turn: 2, team: 'player' });
  });

  it("never lets the player order a guest, or attack one, but lets the player's units walk through it", () => {
    const state = withGuest({ foeAt: 6 });
    expect(() => applyCommand(state, { type: 'wait', unitId: 'guest' })).toThrow(/player phase/);
    const beside = run(state, { type: 'move', unitId: 'hero', to: { x: 1, y: 0 } }).state;
    expect(() => applyCommand(beside, { type: 'attack', unitId: 'hero', target: { x: 2, y: 0 } })).toThrow(/no foe/);
    const past = run(state, { type: 'move', unitId: 'hero', to: { x: 3, y: 0 } }).state;
    expect(past.units.get('hero')).toBeDefined();
    expect(past.grid.cells.find((cell) => cell.unitId === 'hero')).toMatchObject({ x: 3 });
  });

  it('lets the enemy attack a guest', () => {
    const enemyPhase = run(withGuest(), { type: 'end-phase' }).state;
    const [, act] = planNextTurn(enemyPhase);
    expect(act).toEqual({ type: 'attack', unitId: 'foe', target: { x: 2, y: 0 } });
    const { state } = run(enemyPhase, ...planNextTurn(enemyPhase));
    expect(state.units.get('guest')!.health).toBeLessThan(20);
  });

  it('plays the guests with the AI, attacking the enemy, then hands the next turn to the player', () => {
    const guestPhase = run(withGuest(), { type: 'end-phase' }, { type: 'end-phase' }).state;
    expect(guestPhase.turnState!.team).toBe('guest');
    expect(planNextTurn(guestPhase)[1]).toEqual({ type: 'attack', unitId: 'guest', target: { x: 3, y: 0 } });
    const { state, events } = playPhase(guestPhase);
    expect(events.some((event) => event.type === 'strike' && event.strikerId === 'guest')).toBe(true);
    expect(state.turnState).toMatchObject({ turn: 2, team: 'player' });
  });

  it('ends once the last guest falls, going on to the next turn without one', () => {
    const enemyPhase = run(withGuest({ guestHealth: 1 }), { type: 'end-phase' }).state;
    const { state, events } = playPhase(enemyPhase);
    expect(events.some((event) => event.type === 'defeated' && event.unitId === 'guest')).toBe(true);
    expect(state.turnState).toMatchObject({ turn: 2, team: 'player' });
  });

  it("doesn't win or lose the battle for the player", () => {
    const enemyPhase = createTestBattle({
      hero: { unit: makeTestUnit({ team: 'player', health: 1 }), at: { x: 0, y: 0 } },
      foe: { unit: makeTestUnit({ team: 'enemy' }), at: { x: 1, y: 0 } },
      guest: { unit: makeTestUnit({ team: 'guest' }), at: { x: 7, y: 0 } },
    });
    const { state } = playPhase(run(enemyPhase, { type: 'end-phase' }).state);
    expect(state.outcome).toBe('defeat');
  });
});
