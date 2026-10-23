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
  // script's commands play the rest. Default: the enemy and the guests.
  auto?: readonly Team[];
  // Stop once this turn is over without a result. Objectives already lose
  // a battle past TURN_LIMIT (objectives.ts); this is a backstop for one
  // that doesn't, e.g. a long survive.
  maxTurns?: number;
  // Teams played by a planner of their own instead of ai.ts or the script:
  // given the state with that team to move (deployment, for the player), it
  // returns the next commands to give, at least one.
  planners?: Partial<Record<Team, BattlePlanner>>;
}

// Plans a side's next commands: its deployment, or one unit's action.
export type BattlePlanner = (state: BattleState) => BattleCommand[];

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
  const { content = DEFAULT_CONTENT, auto = ['enemy', 'guest'], maxTurns = DEFAULT_MAX_TURNS, planners = {} } = options;
  let history = createHistory(createBattle(script.setup, script.seed, content));
  let next = 0;
  const result = (error: RunResult['error'] = null): RunResult => ({ history, state: getCurrentState(history), error });

  for (;;) {
    const state = getCurrentState(history);
    if (state.outcome || (state.turnState?.turn ?? 0) > maxTurns) return result();
    const planned = getAutoCommands(state, auto, planners);
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

// What the side to move does next when a planner or the AI plays it:
// deployment for the player, else the next unit's action. Empty when it's
// a scripted side's move.
function getAutoCommands(
  state: BattleState,
  auto: readonly Team[],
  planners: Partial<Record<Team, BattlePlanner>>,
): BattleCommand[] {
  const team = state.stage === 'deployment' ? 'player' : state.turnState?.team;
  if (!team) return [];
  const planner = planners[team];
  if (planner) {
    const commands = planner(state);
    if (commands.length === 0) throw new Error(`The ${team} planner gave no command`);
    return commands;
  }
  if (!auto.includes(team)) return [];
  return state.stage === 'deployment' ? planDeployment(state) : planNextTurn(state);
}
