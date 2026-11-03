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
  // A unit that may still move `movement` tiles after acting (a Momentum
  // kill), or null/missing for none. It isn't done until it moves or waits.
  canto?: Canto | null;
  // The units an Encore kill (see modifiers.ts) let act again this phase,
  // which can't again until the next.
  encored?: readonly string[];
}

export interface Canto {
  unitId: string;
  movement: number;
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

// A unit that's done has also used up its move.
// (It ends a canto of its own.)
export function markDone(state: TurnState, unitId: string): TurnState {
  const done = withId(state.done, unitId);
  if (done === state.done) return state;
  const canto = state.canto?.unitId === unitId ? null : state.canto;
  return Object.freeze({ ...state, moved: withId(state.moved, unitId), done, canto });
}

// Lets `unitId`, having acted, move `movement` more tiles before it's done
// (see Canto).
export function startCanto(state: TurnState, unitId: string, movement: number): TurnState {
  return Object.freeze({ ...state, canto: Object.freeze({ unitId, movement }) });
}

// Lets `unitId` move and act again this phase (an Encore), once: it's no
// longer moved or done, and it's marked as encored (see hasEncored).
export function grantEncore(state: TurnState, unitId: string): TurnState {
  return Object.freeze({
    ...state,
    moved: Object.freeze(state.moved.filter((id) => id !== unitId)),
    done: Object.freeze(state.done.filter((id) => id !== unitId)),
    canto: state.canto?.unitId === unitId ? null : state.canto,
    encored: withId(state.encored ?? [], unitId),
  });
}

// Whether `unitId` has had its Encore this phase.
export function hasEncored(state: TurnState, unitId: string): boolean {
  return state.encored?.includes(unitId) ?? false;
}

// The canto `unitId` is on, or null.
export function getCanto(state: TurnState | null | undefined, unitId: string): Canto | null {
  return state?.canto?.unitId === unitId ? state.canto : null;
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
