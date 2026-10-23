// Pure team relations over the unitId -> unit registry: which units are on
// a team, who a team may walk through, and who it may attack. No Phaser,
// no hidden state.

import type { Team } from './turns.ts';

export type TeamRegistry = ReadonlyMap<string, { team: Team }>;

// The ids of `team`'s units, in registry order.
export function getTeamUnitIds(units: TeamRegistry, team: Team): string[] {
  return [...units].filter(([, unit]) => unit.team === team).map(([unitId]) => unitId);
}

// Whether two teams fight on the same side: a team with itself, and the
// player with the guests. The enemy is allied with nobody else.
export function areAllied(a: Team, b: Team): boolean {
  return a === b || (a !== 'enemy' && b !== 'enemy');
}

// Whether a unit on `team` can walk through unitId's tile: only allies let
// it pass. Unknown ids block.
export function isAllyOf(units: TeamRegistry, team: Team, unitId: string): boolean {
  const other = units.get(unitId);
  return other !== undefined && areAllied(team, other.team);
}

// Whether unitId is fair game for a unit on `team` to attack: any unit on
// a side not allied with it. Unknown ids aren't.
export function isHostileTo(units: TeamRegistry, team: Team, unitId: string): boolean {
  const other = units.get(unitId);
  return other !== undefined && !areAllied(team, other.team);
}
