// Plays a battle without the game running: from a BattleSetup and a seed,
// a list of commands for the sides someone scripts, and the AI (ai.ts) for
// the sides left to play themselves. Tests, balancing runs and scripted
// scenarios call runBattle; the result is the whole history, so any state
// along the way can be checked.

import { createBattleLevel, DEFAULT_CONTENT, type BattleSetup, type GameContent } from '../battleSetup.ts';
import type { Team } from '../turns.ts';
import { planDeployment, planNextTurn } from './ai.ts';
import { BattleCommandError, type BattleCommand } from './commands.ts';
import { createHistory, dispatch, getCurrentState, type BattleHistory } from './history.ts';
import { createBattleState, type BattleState } from './state.ts';

// A battle written down: which one, the seed its rolls come from, and the
// commands given in it. Plain JSON, so one can be saved and shared.
export interface BattleScript {
  setup: BattleSetup;
  seed: number;
  commands: readonly BattleCommand[];
}

export interface RunOptions {
  // The authored data the level is built from.
  content?: GameContent;
  // The teams the AI plays (deployment included, for the player). The
  // script's commands play the rest. Default: the enemy.
  auto?: readonly Team[];
  // Stop once this turn is over without a result, so two sides that never
  // reach each other can't run forever.
  maxTurns?: number;
}

export interface RunResult {
  history: BattleHistory;
  // The battle where it stopped: decided, out of commands, or past maxTurns.
  state: BattleState;
  // Why it stopped short, if a scripted command wasn't allowed: which one
  // (by index in the script) and why.
  error: { index: number; command: BattleCommand; message: string } | null;
}

const DEFAULT_MAX_TURNS = 50;

// The state the battle `setup` names starts in, its rolls seeded by `seed`.
export function createBattle(setup: BattleSetup, seed: number, content: GameContent = DEFAULT_CONTENT): BattleState {
  return createBattleState(createBattleLevel(setup, content), seed);
}

// Plays `script` out: the AI's teams take their turns as they come up, the
// script's commands are given in order otherwise, and it stops once the
// battle is decided, the script runs out while a scripted side has the
// move, or the turn limit passes.
export function runBattle(script: BattleScript, options: RunOptions = {}): RunResult {
  const { content = DEFAULT_CONTENT, auto = ['enemy'], maxTurns = DEFAULT_MAX_TURNS } = options;
  let history = createHistory(createBattle(script.setup, script.seed, content));
  let next = 0;
  const result = (error: RunResult['error'] = null): RunResult => ({ history, state: getCurrentState(history), error });

  for (;;) {
    const state = getCurrentState(history);
    if (state.outcome || (state.turnState?.turn ?? 0) > maxTurns) return result();
    const planned = getAutoCommands(state, auto);
    if (planned.length > 0) {
      for (const command of planned) history = dispatch(history, command).history;
      continue;
    }
    const command = script.commands[next];
    if (!command) return result();
    try {
      history = dispatch(history, command).history;
    } catch (error) {
      if (!(error instanceof BattleCommandError)) throw error;
      return result({ index: next, command, message: error.message });
    }
    next += 1;
  }
}

// What the AI does next for whichever of `auto`'s teams has the move:
// deployment for the player, else the next unit's action. Empty when it's
// a scripted side's move.
function getAutoCommands(state: BattleState, auto: readonly Team[]): BattleCommand[] {
  if (state.stage === 'deployment') return auto.includes('player') ? planDeployment(state) : [];
  const team = state.turnState?.team;
  return team && auto.includes(team) ? planNextTurn(state) : [];
}
