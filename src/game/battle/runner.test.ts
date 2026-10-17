import { describe, expect, it } from 'vitest';
import { FIRST_STORY_CHAPTER, type BattleSetup } from '../battleSetup.ts';
import { TRAINEE_ID } from '../trainingLevel.ts';
import { getCommands } from './history.ts';
import { createBattle, runBattle } from './runner.ts';

const training: BattleSetup = { mode: 'training', unitClass: 'warrior' };

describe('runBattle', () => {
  it('plays the script for the player and the AI for the enemy', () => {
    const { state, error, history } = runBattle({
      setup: training,
      seed: 3,
      commands: [{ type: 'start-battle' }, { type: 'wait', unitId: TRAINEE_ID }],
    });
    expect(error).toBeNull();
    // The sparring partner walks up and attacks on the enemy phase.
    expect(
      getCommands(history)
        .slice(2)
        .map((command) => command.type),
    ).toEqual(['move', 'attack']);
    expect(state.turnState).toMatchObject({ turn: 2, team: 'player' });
  });

  it('reports a command it can’t carry out, and stops there', () => {
    const { error, state } = runBattle({
      setup: training,
      seed: 3,
      commands: [{ type: 'start-battle' }, { type: 'move', unitId: TRAINEE_ID, to: { x: 9, y: 9 } }],
    });
    expect(error).toMatchObject({ index: 1, command: { type: 'move' } });
    expect(state.turnState).toMatchObject({ turn: 1, team: 'player' });
  });

  it('plays a whole battle by itself, the same way every time for a seed', () => {
    const script = { setup: FIRST_STORY_CHAPTER, seed: 11, commands: [] };
    const first = runBattle(script, { auto: ['player', 'enemy'] });
    const again = runBattle(script, { auto: ['player', 'enemy'] });
    expect(first.state.outcome).not.toBeNull();
    expect(getCommands(again.history)).toEqual(getCommands(first.history));
  });

  it('plays a Warband stage by itself', () => {
    const { state } = runBattle(
      { setup: { mode: 'warband', seed: 5, stage: 1 }, seed: 5, commands: [] },
      { auto: ['player', 'enemy'] },
    );
    expect(state.stage).toBe('battle');
    expect(state.outcome !== null || state.turnState!.turn > 50).toBe(true);
  });

  it('stops after the turn limit', () => {
    const { state } = runBattle(
      { setup: training, seed: 1, commands: [{ type: 'start-battle' }, { type: 'end-phase' }, { type: 'end-phase' }] },
      { auto: ['enemy'], maxTurns: 1 },
    );
    expect(state.outcome ?? state.turnState!.turn).not.toBe(1);
  });
});

describe('createBattle', () => {
  it('starts the setup’s level in deployment, seeded', () => {
    const state = createBattle(FIRST_STORY_CHAPTER, 42);
    expect(state.stage).toBe('deployment');
    expect(state.rngState).toBe(42);
  });
});
