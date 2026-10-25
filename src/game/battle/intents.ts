// Enemy intents, Into the Breach style: what each enemy plans to do on the
// coming enemy phase, worked out during the player's phase so the player
// can plan around it. Each enemy is planned the way the enemy phase plays
// it (planUnitTurn, in registry order), with those before it already moved
// to where they'll stand, so the picture holds unless the dice change it
// (a kill or a miss can send a later enemy elsewhere). Pure: reads a state.

import { getCombatForecast, type TargetTile } from '../combat.ts';
import { getCell, getDistance, moveUnit, type Point } from '../grid.ts';
import { getTeamUnitIds } from '../teams.ts';
import { planUnitTurn } from './ai.ts';
import type { BattleState } from './state.ts';

export interface EnemyIntent {
  unitId: string;
  // The route it walks, from where it stands (just that tile to stay put).
  path: readonly Point[];
  // The unit it attacks from the end of its route, or null if it only moves.
  target: TargetTile | null;
  // Per landed strike (no crit), how many strikes it gets, and its hit
  // chance, as the combat forecast has them; 0 with no target.
  damage: number;
  strikes: number;
  hit: number;
}

// What every enemy in play plans for the next enemy phase, in the order
// they'll act. Empty outside a battle being fought.
export function getEnemyIntents(state: BattleState): EnemyIntent[] {
  if (state.stage !== 'battle' || state.outcome) return [];
  const intents: EnemyIntent[] = [];
  let planned = state;
  for (const unitId of getTeamUnitIds(state.units, 'enemy')) {
    const [move, act] = planUnitTurn(planned, unitId);
    if (move?.type !== 'move' || !move.path) continue;
    const path = move.path;
    const from = path[0];
    const end = path[path.length - 1];
    planned = { ...planned, grid: moveUnit(planned.grid, from, end) };
    const target = act?.type === 'attack' ? findTarget(planned, act.target) : null;
    const intent: EnemyIntent = { unitId, path, target, damage: 0, strikes: 0, hit: 0 };
    if (target) {
      const forecast = getCombatForecast(state.units.get(unitId)!, state.units.get(target.unitId)!, {
        distance: getDistance(end, target),
      }).attacker;
      intent.damage = forecast.damage ?? 0;
      intent.strikes = forecast.strikes;
      intent.hit = forecast.hit ?? 0;
    }
    intents.push(intent);
  }
  return intents;
}

function findTarget(state: BattleState, tile: Point): TargetTile | null {
  const unitId = getCell(state.grid, tile.x, tile.y)?.unitId;
  return unitId ? { x: tile.x, y: tile.y, unitId } : null;
}

// What the enemies' intents threaten one unit with: the HP it'd lose if
// every planned strike landed, and whether that would fell it.
export interface IntentThreat {
  unitId: string;
  at: Point;
  damage: number;
  attackers: number;
  lethal: boolean;
}

// The intents' threats, one per targeted unit, in the order the units are
// first targeted.
export function getIntentThreats(state: BattleState, intents: readonly EnemyIntent[]): IntentThreat[] {
  const threats = new Map<string, IntentThreat>();
  for (const { target, damage, strikes } of intents) {
    if (!target) continue;
    const threat = threats.get(target.unitId) ?? {
      unitId: target.unitId,
      at: { x: target.x, y: target.y },
      damage: 0,
      attackers: 0,
      lethal: false,
    };
    threat.damage += damage * strikes;
    threat.attackers += 1;
    threat.lethal = threat.damage >= (state.units.get(target.unitId)?.health ?? 0);
    threats.set(target.unitId, threat);
  }
  return [...threats.values()];
}
