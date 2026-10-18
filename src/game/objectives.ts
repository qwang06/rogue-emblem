// A battle's objective: what wins it and what loses it, shown on the
// Objective screen before the battle starts and in the header during it.
// Every map is a rout (defeat all enemies) unless it says otherwise. The
// classic kinds:
// - rout: defeat every enemy
// - seize: end a unit's move on the marked tile
// - boss: defeat one named enemy
// - survive: hold out until `turns` turns have passed
// Every kind is lost when all the player's units fall, and won when every
// enemy falls (there's nothing left to seize from or survive). Every kind
// but survive is also lost once TURN_LIMIT turns pass undecided, so a
// battle that stalls (two sides that never reach each other) still ends. Levels hold
// the objective resolved to its tile or unit; a Warband region only names
// the kind (ObjectiveSpec, resolved by warband/stageObjective.ts).

import { isSameTile, type Point } from './grid.ts';
import { getBattleOutcome, type BattleOutcome, type Team } from './turns.ts';

export type Objective =
  | { kind: 'rout' }
  | { kind: 'seize'; tile: Point }
  | { kind: 'boss'; unitId: string; name: string }
  | { kind: 'survive'; turns: number };

export type ObjectiveKind = Objective['kind'];

export const OBJECTIVE_KINDS: readonly ObjectiveKind[] = Object.freeze(['rout', 'seize', 'boss', 'survive']);

// An objective before it's placed on a map: just its kind, plus the turn
// count for survive (SURVIVE_TURNS if unset).
export type ObjectiveSpec = { kind: 'rout' | 'seize' | 'boss' } | { kind: 'survive'; turns?: number };

// How many turns a survive objective lasts when it doesn't say.
export const SURVIVE_TURNS = 4;

// The turns a rout, seize or boss battle has to be won in: still undecided
// once this turn is over, it's lost.
export const TURN_LIMIT = 40;

// Defeat every enemy; lose if every player unit falls.
export const ROUT: Objective = Object.freeze({ kind: 'rout' });

// The objective of a level that doesn't set one.
export const DEFAULT_OBJECTIVE: Objective = ROUT;

export interface ObjectiveText {
  // What the player must do to win.
  goal: string;
  // What loses the battle.
  defeat: string;
}

const turnsText = (turns: number) => `${turns} turn${turns === 1 ? '' : 's'}`;

// The objective as the words the Objective screen shows.
export function describeObjective(objective: Objective): ObjectiveText {
  const defeat =
    objective.kind === 'survive' ? 'All your units fall' : `All your units fall, or turn ${TURN_LIMIT} ends`;
  switch (objective.kind) {
    case 'rout':
      return Object.freeze({ goal: 'Defeat all enemies', defeat });
    case 'seize':
      return Object.freeze({ goal: 'Seize the marked tile', defeat });
    case 'boss':
      return Object.freeze({ goal: `Defeat ${objective.name}`, defeat });
    case 'survive':
      return Object.freeze({ goal: `Survive ${turnsText(objective.turns)}`, defeat });
  }
}

// The header's short readout of the objective on turn `turn`: its kind and
// the turn being played out of the turns it has, e.g. "Seize 3/40" (out of
// TURN_LIMIT) or "Survive 2/4" (out of the turns to survive).
export function getObjectiveStatus(objective: Objective, turn: number): string {
  const limit = objective.kind === 'survive' ? objective.turns : TURN_LIMIT;
  return `${OBJECTIVE_NAMES[objective.kind]} ${Math.min(turn, limit)}/${limit}`;
}

const OBJECTIVE_NAMES: Record<ObjectiveKind, string> = {
  rout: 'Rout',
  seize: 'Seize',
  boss: 'Boss',
  survive: 'Survive',
};

// What deciding a battle looks at: every unit (alive or not, with the tile
// it stands on, null if it's off the map) and the turn being played.
export interface BattleSnapshot {
  units: readonly { unitId: string; team: Team; alive: boolean; position: Point | null }[];
  turn: number;
}

// 'victory' or 'defeat' once `objective` decides the battle, else null.
// Losing every player unit is a defeat whatever else happened; then a rout
// (every enemy down) wins any objective, and each kind adds its own win:
// a living player unit on the seize tile, the boss down (or gone), or the
// turn count passing the survive turns (checked as each turn starts).
// Any other kind still undecided once the turn count passes TURN_LIMIT is
// a defeat.
export function getObjectiveOutcome(objective: Objective, state: BattleSnapshot): BattleOutcome | null {
  const units = state.units.map((u) => ({ team: u.team, isAlive: () => u.alive }));
  const outcome = getBattleOutcome(units) ?? getObjectiveWin(objective, state);
  if (outcome) return outcome;
  return isPastTurnLimit(objective, state.turn) ? 'defeat' : null;
}

// Whether the battle is on a turn past its TURN_LIMIT; never for survive,
// which ends on its own turn count.
export function isPastTurnLimit(objective: Objective, turn: number): boolean {
  return objective.kind !== 'survive' && turn > TURN_LIMIT;
}

// The win `objective` adds on top of a rout, or null.
function getObjectiveWin(objective: Objective, state: BattleSnapshot): BattleOutcome | null {
  switch (objective.kind) {
    case 'rout':
      return null;
    case 'seize': {
      const seized = state.units.some(
        (u) => u.team === 'player' && u.alive && u.position && isSameTile(u.position, objective.tile),
      );
      return seized ? 'victory' : null;
    }
    case 'boss': {
      const boss = state.units.find((u) => u.unitId === objective.unitId);
      return boss?.alive ? null : 'victory';
    }
    case 'survive':
      return state.turn > objective.turns ? 'victory' : null;
  }
}
