import { describe, expect, it } from 'vitest';
import {
  createTurnState,
  getBattleOutcome,
  hasMoved,
  isDone,
  isPhaseOver,
  markDone,
  markMoved,
  nextPhase,
  unmarkMoved,
  type Team,
} from './turns.ts';
import { Unit } from './Unit.ts';

const makeUnit = (team: Team, health = 10) =>
  new Unit({ name: team, health, strength: 4, defense: 2, movement: 5, team });

describe('createTurnState', () => {
  it('starts on turn 1 with the player phase and nobody moved or done', () => {
    expect(createTurnState()).toEqual({ turn: 1, team: 'player', moved: [], done: [] });
  });

  it('accepts a turn and team', () => {
    expect(createTurnState(3, 'enemy')).toMatchObject({ turn: 3, team: 'enemy' });
  });

  it('is frozen', () => {
    const state = createTurnState();
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.moved)).toBe(true);
    expect(Object.isFrozen(state.done)).toBe(true);
  });
});

describe('markMoved', () => {
  it('records the move without finishing the unit', () => {
    const state = markMoved(createTurnState(), 'a');
    expect(hasMoved(state, 'a')).toBe(true);
    expect(isDone(state, 'a')).toBe(false);
  });

  it('never mutates the state it is given', () => {
    const before = createTurnState();
    markMoved(before, 'a');
    expect(hasMoved(before, 'a')).toBe(false);
  });

  it('returns the same state when the unit already moved', () => {
    const state = markMoved(createTurnState(), 'a');
    expect(markMoved(state, 'a')).toBe(state);
  });
});

describe('unmarkMoved', () => {
  it('gives a unit its move back', () => {
    const state = unmarkMoved(markMoved(createTurnState(), 'a'), 'a');
    expect(hasMoved(state, 'a')).toBe(false);
  });

  it('leaves other units moved', () => {
    const state = unmarkMoved(markMoved(markMoved(createTurnState(), 'a'), 'b'), 'a');
    expect(state.moved).toEqual(['b']);
    expect(Object.isFrozen(state.moved)).toBe(true);
  });

  it('returns the same state when the unit has not moved', () => {
    const state = createTurnState();
    expect(unmarkMoved(state, 'a')).toBe(state);
  });

  it('never takes back the move of a unit that is done', () => {
    const state = markDone(createTurnState(), 'a');
    expect(unmarkMoved(state, 'a')).toBe(state);
  });

  it('never mutates the state it is given', () => {
    const before = markMoved(createTurnState(), 'a');
    unmarkMoved(before, 'a');
    expect(hasMoved(before, 'a')).toBe(true);
  });
});

describe('markDone', () => {
  it('finishes the unit and uses up its move', () => {
    const state = markDone(createTurnState(), 'a');
    expect(isDone(state, 'a')).toBe(true);
    expect(hasMoved(state, 'a')).toBe(true);
  });

  it('does not list a unit that moved first twice', () => {
    const state = markDone(markMoved(createTurnState(), 'a'), 'a');
    expect(state.moved).toEqual(['a']);
  });

  it('returns the same state when the unit is already done', () => {
    const state = markDone(createTurnState(), 'a');
    expect(markDone(state, 'a')).toBe(state);
  });

  it('only affects the unit given', () => {
    const state = markDone(createTurnState(), 'a');
    expect(isDone(state, 'b')).toBe(false);
    expect(hasMoved(state, 'b')).toBe(false);
  });
});

describe('isPhaseOver', () => {
  it('is false while any unit still has to act', () => {
    const state = markDone(createTurnState(), 'a');
    expect(isPhaseOver(state, ['a', 'b'])).toBe(false);
  });

  it('is false when units have only moved', () => {
    const state = markMoved(markMoved(createTurnState(), 'a'), 'b');
    expect(isPhaseOver(state, ['a', 'b'])).toBe(false);
  });

  it('is true once every unit is done', () => {
    const state = markDone(markDone(createTurnState(), 'a'), 'b');
    expect(isPhaseOver(state, ['a', 'b'])).toBe(true);
  });

  it('ignores done units no longer in play (e.g. defeated)', () => {
    const state = markDone(createTurnState(), 'a');
    expect(isPhaseOver(state, ['a'])).toBe(true);
  });

  it('is true for a team with no units left', () => {
    expect(isPhaseOver(createTurnState(), [])).toBe(true);
  });
});

describe('nextPhase', () => {
  it('goes from the player phase to the enemy phase of the same turn', () => {
    expect(nextPhase(createTurnState(1, 'player'))).toEqual(createTurnState(1, 'enemy'));
  });

  it('goes from the enemy phase to the player phase of the next turn', () => {
    expect(nextPhase(createTurnState(1, 'enemy'))).toEqual(createTurnState(2, 'player'));
  });

  it('starts the new phase with nobody moved or done', () => {
    const state = nextPhase(markDone(markMoved(createTurnState(), 'b'), 'a'));
    expect(state.moved).toEqual([]);
    expect(state.done).toEqual([]);
  });
});

describe('getBattleOutcome', () => {
  it('is null while both sides have living units', () => {
    expect(getBattleOutcome([makeUnit('player'), makeUnit('enemy')])).toBeNull();
  });

  it('is victory once every enemy is defeated', () => {
    expect(getBattleOutcome([makeUnit('player'), makeUnit('enemy', 0)])).toBe('victory');
  });

  it('is defeat once every player unit is defeated', () => {
    expect(getBattleOutcome([makeUnit('player', 0), makeUnit('enemy')])).toBe('defeat');
  });

  it('is victory when enemies were removed entirely', () => {
    expect(getBattleOutcome([makeUnit('player')])).toBe('victory');
  });

  it('counts defeat before victory when both sides are wiped out', () => {
    expect(getBattleOutcome([])).toBe('defeat');
  });

  it('accepts any iterable of units, like a Map of the registry', () => {
    const units = new Map([
      ['a', makeUnit('player')],
      ['b', makeUnit('enemy')],
    ]);
    expect(getBattleOutcome(units.values())).toBeNull();
  });
});
