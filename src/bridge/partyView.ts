// Snapshot of a side for the battle frame's rosters (BattleSide.tsx):
// every unit of the team, with its health and whether it has acted this
// phase, the fallen kept dim at the end so a roster never shrinks
// mid-battle. Plain frozen data.

import type { BattleState } from '../game/battle/state.ts';
import { getClassLabel } from './views.ts';
import { getUnitSprite } from '../game/tileset.ts';
import { isDone, type Team } from '../game/turns.ts';
import type { Unit } from '../game/Unit.ts';

export interface PartyUnitView {
  id: string;
  name: string;
  classLabel: string | null;
  // Its art name (getUnitSprite), for its sprite.
  sprite: string;
  level: number;
  health: number;
  maxHealth: number;
  // Done for the phase (moved and acted), so it reads dim.
  acted: boolean;
  // Taken off the map at 0 HP.
  fallen: boolean;
}

function toPartyUnitView(id: string, unit: Unit, acted: boolean, fallen: boolean): PartyUnitView {
  return Object.freeze({
    id,
    name: unit.name,
    classLabel: getClassLabel(unit.unitClass),
    sprite: getUnitSprite(unit.unitClass, unit.faction),
    level: unit.level,
    health: fallen ? 0 : unit.health,
    maxHealth: unit.maxHealth,
    acted,
    fallen,
  });
}

// A team's units, standing ones first: the player's in `deployed` order
// (every player unit on the map before the battle starts, in map order),
// any other team's in map order with its fallen after.
export function toPartyView(
  state: Pick<BattleState, 'units' | 'turnState' | 'fallen' | 'deployed'>,
  team: Team = 'player',
): readonly PartyUnitView[] {
  const onMap = [...state.units].filter(([, unit]) => unit.team === team).map(([id]) => id);
  const lost = [...state.fallen].filter(([, unit]) => unit.team === team).map(([id]) => id);
  const ids = team === 'player' && state.deployed.length > 0 ? state.deployed : [...onMap, ...lost];
  const standing: PartyUnitView[] = [];
  const fallen: PartyUnitView[] = [];
  for (const id of ids) {
    const unit = state.units.get(id);
    if (unit) {
      if (unit.team !== team) continue;
      const acted = state.turnState?.team === team && isDone(state.turnState, id);
      standing.push(toPartyUnitView(id, unit, acted, false));
      continue;
    }
    const gone = state.fallen.get(id);
    if (gone && gone.team === team) fallen.push(toPartyUnitView(id, gone, false, true));
  }
  return Object.freeze([...standing, ...fallen]);
}
