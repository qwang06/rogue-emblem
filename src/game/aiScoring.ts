// Pure scoring of enemy attacks: how much an enemy wants to make a given
// attack, read off the combat forecast. Higher is better. Kills come
// first, then expected damage dealt against damage taken back; soft
// targets (mages and healers) get a nudge, and an attack whose counter
// could kill the attacker is all but ruled out unless it's lethal itself.
// No Phaser, no rendering, no hidden state.

import { getCombatForecast, getDamageType, type CombatSide, type Combatant, type ForecastSide } from './combat.ts';
import { CRIT_MULTIPLIER } from './combatStats.ts';
import { getDistance, type Point } from './grid.ts';
import { isStaff } from './healing.ts';
import type { Inventory } from './items.ts';

export type Forecast = Record<CombatSide, ForecastSide>;

export interface ScoreOptions {
  // Whether the defender is a soft target (see isSoftTarget).
  soft?: boolean;
}

// A unit the enemy might attack: its combat stats plus its inventory, which
// decides whether it's a soft target.
export interface Foe extends Combatant {
  items?: Inventory;
}

// Bonus for an attack that kills if every strike lands, scaled by the
// attacker's hit chance — worth more than any chip damage.
export const KILL_BONUS = 50;
// Bonus for attacking a mage or healer.
export const SOFT_TARGET_BONUS = 5;
// How much each point of expected counter damage takes off the score.
export const COUNTER_WEIGHT = 0.5;
// Penalty for an attack whose counter could kill the attacker, unless the
// attack could kill first.
export const SUICIDE_PENALTY = 100;

// Scores one attack from getCombatForecast's { attacker, defender }:
// expected damage dealt (capped at the defender's health), minus
// COUNTER_WEIGHT × expected counter damage (capped at the attacker's
// health), plus KILL_BONUS × hit chance when the attack can be lethal, plus
// SOFT_TARGET_BONUS for a soft target, minus SUICIDE_PENALTY when the
// counter can be lethal and the attack can't.
export function scoreAttack(forecast: Forecast, { soft = false }: ScoreOptions = {}): number {
  const { attacker, defender } = forecast;
  const dealt = Math.min(defender.health, expectedDamage(attacker));
  const taken = Math.min(attacker.health, expectedDamage(defender));
  const lethal = canKill(attacker, defender.health);
  const suicidal = !lethal && canKill(defender, attacker.health);

  let score = dealt - COUNTER_WEIGHT * taken;
  if (lethal) score += (KILL_BONUS * (attacker.hit ?? 0)) / 100;
  if (soft) score += SOFT_TARGET_BONUS;
  if (suicidal) score -= SUICIDE_PENALTY;
  return score;
}

// Whether a unit is a soft target: it carries a staff (a healer) or fights
// with magic (a mage).
export function isSoftTarget(unit: Pick<Foe, 'weapon' | 'items'>): boolean {
  if (unit.items?.some((entry) => isStaff(entry.item))) return true;
  return !!unit.weapon && getDamageType(unit) === 'magical';
}

// A scorer for planRushAction (enemyAI.ts): scores `attacker` striking the
// unit at `target` from `from`, looking the defender up with `getFoe`.
export function createAttackScorer(
  attacker: Combatant,
  getFoe: (unitId: string) => Foe,
): (from: Point, target: Point & { unitId: string }) => number {
  return (from, target) => {
    const defender = getFoe(target.unitId);
    const forecast = getCombatForecast(attacker, defender, { distance: getDistance(from, target) });
    return scoreAttack(forecast, { soft: isSoftTarget(defender) });
  };
}

// Average damage a side deals over the exchange: per strike, damage × hit
// chance, with crits adding (CRIT_MULTIPLIER − 1) × damage × crit chance.
function expectedDamage(side: ForecastSide): number {
  if (side.damage === null || side.hit === null) return 0;
  const critChance = (side.crit ?? 0) / 100;
  const perStrike = side.damage * (side.hit / 100) * (1 + critChance * (CRIT_MULTIPLIER - 1));
  return side.strikes * perStrike;
}

// Whether a side's strikes, all landing without crits, take `health` to 0.
function canKill(side: ForecastSide, health: number): boolean {
  return side.damage !== null && side.damage > 0 && side.damage * side.strikes >= health;
}
