// A battle as the state it started from and every command since, with the
// state each one led to. Going back is dropping entries off the end: the
// states are kept, so undoing costs nothing and needs no inverse commands.
// The commands alone, replayed from the start, rebuild the same battle
// (rolls included, since they come from the state's seed), which is what
// saving a battle as a script relies on. Pure, no Phaser.

import { applyCommand, type BattleCommand, type BattleEvent } from './commands.ts';
import type { BattleState } from './state.ts';
import type { Team } from '../turns.ts';

export interface HistoryEntry {
  command: BattleCommand;
  // The state after the command.
  state: BattleState;
  events: readonly BattleEvent[];
}

export interface BattleHistory {
  initial: BattleState;
  entries: readonly HistoryEntry[];
}

export function createHistory(initial: BattleState): BattleHistory {
  return Object.freeze({ initial, entries: Object.freeze([]) });
}

// The battle as it stands now.
export function getCurrentState(history: BattleHistory): BattleState {
  return history.entries[history.entries.length - 1]?.state ?? history.initial;
}

// Every command so far, in order: the script that replays this battle.
export function getCommands(history: BattleHistory): BattleCommand[] {
  return history.entries.map((entry) => entry.command);
}

// Applies `command` to the current state and records it. Throws a
// BattleCommandError (leaving the history as it was) if it isn't allowed.
export function dispatch(
  history: BattleHistory,
  command: BattleCommand,
): { history: BattleHistory; events: readonly BattleEvent[] } {
  const { state, events } = applyCommand(getCurrentState(history), command);
  const entries = Object.freeze([...history.entries, Object.freeze({ command, state, events })]);
  return { history: Object.freeze({ ...history, entries }), events };
}

// The history with its last `steps` commands taken back (all of them, at
// most).
export function undo(history: BattleHistory, steps = 1): BattleHistory {
  return rewindTo(history, Math.max(0, history.entries.length - steps));
}

// The history as it was after its first `count` commands.
export function rewindTo(history: BattleHistory, count: number): BattleHistory {
  if (count >= history.entries.length) return history;
  return Object.freeze({ ...history, entries: Object.freeze(history.entries.slice(0, count)) });
}

// Replays `commands` from `initial`. Throws a BattleCommandError at the
// first one that isn't allowed.
export function replay(initial: BattleState, commands: readonly BattleCommand[]): BattleHistory {
  return commands.reduce((history, command) => dispatch(history, command).history, createHistory(initial));
}

// The history from before the last action a unit of `team` took (its move,
// equips and act together, or ending the phase early), dropping
// everything since, e.g. the enemy phase that followed. Null when that
// team hasn't acted since the battle started.
export function undoLastAction(history: BattleHistory, team: Team = 'player'): BattleHistory | null {
  const { entries } = history;
  const stateBefore = (index: number) => (index === 0 ? history.initial : entries[index - 1].state);
  for (let index = entries.length - 1; index >= 0; index--) {
    const { command } = entries[index];
    const before = stateBefore(index);
    if (command.type === 'end-phase') {
      if (before.turnState?.team === team) return rewindTo(history, index);
      continue;
    }
    if (!('unitId' in command) || command.type === 'place') continue;
    if (before.units.get(command.unitId)?.team !== team) continue;
    // Take the unit's move and equips before its act back with it.
    let start = index;
    while (start > 0) {
      const previous = entries[start - 1].command;
      const sameTurn = (previous.type === 'move' || previous.type === 'equip') && previous.unitId === command.unitId;
      if (!sameTurn) break;
      start -= 1;
    }
    return rewindTo(history, start);
  }
  return null;
}
