// Snapshot of the player's side for the battle frame's party roster
// (BattleSide.tsx): every deployed unit, in deployment order, with its
// health and whether it has acted this phase, the fallen kept dim at the
// end so the roster never shrinks mid-battle. Plain frozen data.

import type { BattleState } from '../game/battle/state.ts';
import { getClassLabel } from './views.ts';
import { getUnitSprite } from '../game/tileset.ts';
import { isDone } from '../game/turns.ts';
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

// The player's units in `deployed` order (every player unit on the map
// before the battle starts, in map order), standing ones first.
export function toPartyView(
  state: Pick<BattleState, 'units' | 'turnState' | 'fallen' | 'deployed'>,
): readonly PartyUnitView[] {
  const ids =
    state.deployed.length > 0
      ? state.deployed
      : [...state.units].filter(([, unit]) => unit.team === 'player').map(([id]) => id);
  const standing: PartyUnitView[] = [];
  const fallen: PartyUnitView[] = [];
  for (const id of ids) {
    const unit = state.units.get(id);
    if (unit) {
      if (unit.team !== 'player') continue;
      const acted = state.turnState?.team === 'player' && isDone(state.turnState, id);
      standing.push(toPartyUnitView(id, unit, acted, false));
      continue;
    }
    const lost = state.fallen.get(id);
    if (lost && lost.team === 'player') fallen.push(toPartyUnitView(id, lost, false, true));
  }
  return Object.freeze([...standing, ...fallen]);
}
