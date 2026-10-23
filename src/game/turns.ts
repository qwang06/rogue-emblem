// Pure turn rules. A battle cycles through phases: first (when any are on
// the map) the guests, allies the AI plays, move all their units, then the
// player moves all of theirs, then the enemy all of theirs; that cycle
// makes one turn.
// Within a phase each unit may move once and then act once (attack, use a
// skill, or wait); acting ends its part in the phase. No Phaser, no
// rendering, no hidden state — every function returns a new frozen state.

// 'guest' units fight on the player's side (see areAllied in teams.ts) but
// nobody controls them: they act on their own phase, first in each turn.
export type Team = 'player' | 'enemy' | 'guest';

export interface TurnState {
  turn: number;
  team: Team;
  moved: readonly string[];
  done: readonly string[];
}

export type BattleOutcome = 'victory' | 'defeat';

export const PHASE_ORDER: readonly Team[] = Object.freeze(['guest', 'player', 'enemy']);

// Turn state: { turn, team, moved, done } where team is whose phase it is,
// and moved / done list the unitIds that have moved or finished this phase.
export function createTurnState(turn = 1, team: Team = 'player'): TurnState {
  return Object.freeze({ turn, team, moved: Object.freeze([]), done: Object.freeze([]) });
}

function withId(list: readonly string[], unitId: string): readonly string[] {
  return list.includes(unitId) ? list : Object.freeze([...list, unitId]);
}

export function markMoved(state: TurnState, unitId: string): TurnState {
  const moved = withId(state.moved, unitId);
  return moved === state.moved ? state : Object.freeze({ ...state, moved });
}

// Takes back a unit's move (e.g. the player cancels out of the action
// menu after moving). A unit that's already done keeps its move.
export function unmarkMoved(state: TurnState, unitId: string): TurnState {
  if (!hasMoved(state, unitId) || isDone(state, unitId)) return state;
  return Object.freeze({ ...state, moved: Object.freeze(state.moved.filter((id) => id !== unitId)) });
}

// A unit that's done has also used up its move.
export function markDone(state: TurnState, unitId: string): TurnState {
  const done = withId(state.done, unitId);
  if (done === state.done) return state;
  return Object.freeze({ ...state, moved: withId(state.moved, unitId), done });
}

export function hasMoved(state: TurnState, unitId: string): boolean {
  return state.moved.includes(unitId);
}

export function isDone(state: TurnState, unitId: string): boolean {
  return state.done.includes(unitId);
}

// The phase is over once every one of unitIds (the phase team's units
// still in play) is done. A team with no units left is trivially over.
export function isPhaseOver(state: TurnState, unitIds: readonly string[]): boolean {
  return unitIds.every((unitId) => isDone(state, unitId));
}

// The phase a turn opens with: the guests' while any guest is in play
// (`hasGuests`), else the player's.
export function getFirstPhase(turn: number, hasGuests = false): TurnState {
  return createTurnState(turn, hasGuests ? 'guest' : 'player');
}

// The next phase with a clean slate: guest → player → enemy in the same
// turn, then the next turn's first phase (see getFirstPhase).
export function nextPhase(state: TurnState, hasGuests = false): TurnState {
  const index = PHASE_ORDER.indexOf(state.team);
  if (index === PHASE_ORDER.length - 1) return getFirstPhase(state.turn + 1, hasGuests);
  return createTurnState(state.turn, PHASE_ORDER[index + 1]);
}

// 'victory' once no enemy is alive, 'defeat' once no player unit is, else
// null; guests count for neither. Defeat wins a tie — losing your last unit is never a victory.
export function getBattleOutcome(units: Iterable<{ team: Team; isAlive(): boolean }>): BattleOutcome | null {
  const all = [...units];
  const alive = (team: Team) => all.some((unit) => unit.team === team && unit.isAlive());
  if (!alive('player')) return 'defeat';
  if (!alive('enemy')) return 'victory';
  return null;
}
