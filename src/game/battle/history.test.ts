import { describe, expect, it } from 'vitest';
import type { BattleCommand } from './commands.ts';
import { createHistory, dispatch, getCommands, getCurrentState, replay, undo, undoLastAction } from './history.ts';
import { createTestBattle, makeTestUnit } from './testLevel.ts';

function battle() {
  return createTestBattle(
    {
      hero: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 0 } },
      ally: { unit: makeTestUnit({ team: 'player' }), at: { x: 0, y: 1 } },
      foe: { unit: makeTestUnit({ team: 'enemy', skill: 0 }), at: { x: 4, y: 0 } },
    },
    { height: 2 },
  );
}

function play(commands: BattleCommand[]) {
  return commands.reduce((history, command) => dispatch(history, command).history, createHistory(battle()));
}

const heroAttacks: BattleCommand[] = [
  { type: 'move', unitId: 'hero', to: { x: 3, y: 0 } },
  { type: 'attack', unitId: 'hero', target: { x: 4, y: 0 } },
];

describe('history', () => {
  it('keeps every command and the state it led to', () => {
    const history = play(heroAttacks);
    expect(getCommands(history)).toEqual(heroAttacks);
    expect(getCurrentState(history).units.get('foe')!.health).toBe(14);
  });

  it('goes back to an earlier state, untouched', () => {
    const history = play(heroAttacks);
    const before = undo(history, 2);
    expect(getCurrentState(before)).toBe(history.initial);
    expect(getCurrentState(undo(history)).units.get('foe')!.health).toBe(20);
    expect(undo(createHistory(battle())).entries).toEqual([]);
  });

  it('leaves the history alone when a command is refused', () => {
    const history = play(heroAttacks);
    expect(() => dispatch(history, { type: 'wait', unitId: 'hero' })).toThrow();
    expect(history.entries).toHaveLength(2);
  });

  it('rebuilds the same battle from its commands, rolls included', () => {
    const history = play([
      ...heroAttacks,
      { type: 'wait', unitId: 'ally' },
      { type: 'attack', unitId: 'foe', target: { x: 3, y: 0 } },
    ]);
    const replayed = replay(history.initial, getCommands(history));
    expect(replayed.entries.map((entry) => entry.events)).toEqual(history.entries.map((entry) => entry.events));
    expect(getCurrentState(replayed).rngState).toBe(getCurrentState(history).rngState);
  });

  describe('undoLastAction', () => {
    it('takes back a unit’s move and act together', () => {
      const history = play([
        { type: 'wait', unitId: 'ally' },
        ...heroAttacks.slice(0, 1),
        { type: 'equip', unitId: 'hero', index: 0 },
        heroAttacks[1],
      ]);
      expect(getCommands(undoLastAction(history)!)).toEqual([{ type: 'wait', unitId: 'ally' }]);
    });

    it('takes back a move that hasn’t been followed by an act yet', () => {
      const history = play(heroAttacks.slice(0, 1));
      expect(undoLastAction(history)!.entries).toEqual([]);
    });

    it('takes back the enemy phase along with the action that ended the player’s', () => {
      const history = play([...heroAttacks, { type: 'wait', unitId: 'ally' }, { type: 'wait', unitId: 'foe' }]);
      expect(getCurrentState(history).turnState).toMatchObject({ turn: 2, team: 'player' });
      expect(getCommands(undoLastAction(history)!)).toEqual(heroAttacks);
    });

    it('counts ending the phase early as an action', () => {
      const history = play([{ type: 'end-phase' }, { type: 'wait', unitId: 'foe' }]);
      expect(undoLastAction(history)!.entries).toEqual([]);
    });

    it('is null when the team hasn’t acted', () => {
      expect(undoLastAction(createHistory(battle()))).toBeNull();
    });
  });
});
