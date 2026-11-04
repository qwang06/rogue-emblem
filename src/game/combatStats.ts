// Pure combat formulas: hit, avoid, crit, dodge, attack speed, doubling,
// and the dice rolls that decide them. Fire Emblem style — every rate is a
// whole percentage, and what a strike actually rolls against is the
// attacker's rate minus the defender's, clamped to 0–100. The unit's
// equipped weapon (see weapons.ts) adds its hit and crit, and its weight
// together with its worn armor's slows a unit weaker than the load, and
// its modifiers' combat bonus (see modifiers.ts) adds to the rates. No
// Phaser, no hidden state; randomness
// comes in through an injected `rng` (() => [0, 1)).

import type { CombatBonus } from './modifiers.ts';
import { isTrained, PROFICIENCY_CRIT, PROFICIENCY_HIT, type WeaponType } from './weapons.ts';

// A crit deals this many times the strike's damage.
export const CRIT_MULTIPLIER = 3;
// A unit strikes twice when its attack speed beats its opponent's by at least this.
export const DOUBLE_THRESHOLD = 4;

// The weapon numbers these formulas read.
export interface WeaponStatLine {
  hit: number;
  crit: number;
  weight: number;
  // Its family, for the proficiency bonus; without one it gets none.
  type?: WeaponType;
}

// The stats these formulas read. Missing stats count as 0; a unit without
// a weapon adds no hit or crit and carries no weight. `weaponTypes` are the
// families it's trained in: a weapon of one of them (or a natural one) adds
// PROFICIENCY_HIT and PROFICIENCY_CRIT (see isTrained in weapons.ts).
// `armorAvoid` is what its light armor adds to avoid. `armorWeight` is what
// its worn armor weighs (see getArmorWeight in items.ts). `bonus` is what
// its modifiers add for the exchange at hand (see withCombatBonus in
// combat.ts); missing terms count as 0.
export interface CombatStatLine {
  strength?: number;
  dexterity?: number;
  speed?: number;
  luck?: number;
  armorWeight?: number;
  armorAvoid?: number;
  weaponTypes?: readonly WeaponType[];
  weapon?: WeaponStatLine | null;
  bonus?: Partial<CombatBonus>;
}

// A source of randomness in [0, 1), like Math.random.
export type Rng = () => number;

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// How fast a unit fights: its speed, less however much its load (weapon
// weight plus worn armor weight) exceeds its strength. Drives avoid and
// doubling.
export function getAttackSpeed(unit: CombatStatLine): number {
  return (unit.speed ?? 0) - getOverload(unit);
}

// How much a unit's load (weapon weight plus worn armor weight) exceeds its
// strength, or 0.
export function getOverload(unit: Pick<CombatStatLine, 'strength' | 'armorWeight' | 'weapon'>): number {
  const weight = (unit.weapon?.weight ?? 0) + (unit.armorWeight ?? 0);
  return Math.max(0, weight - (unit.strength ?? 0));
}

// Each this much overload costs a point of movement.
export const OVERLOAD_PER_MOVEMENT = 4;

// The movement a unit's load costs it: 1 per OVERLOAD_PER_MOVEMENT its load
// exceeds its strength (see getPhaseMovement in enemyAI.ts).
export function getLoadMovementPenalty(unit: Pick<CombatStatLine, 'strength' | 'armorWeight' | 'weapon'>): number {
  return Math.floor(getOverload(unit) / OVERLOAD_PER_MOVEMENT);
}

// Whether `unit` fights with a weapon it's trained in (see isTrained).
export function isProficient(unit: CombatStatLine): boolean {
  const weapon = unit.weapon;
  return !!weapon?.type && isTrained(unit.weaponTypes, { type: weapon.type });
}

// The attacker's raw hit rate: weapon hit + dexterity × 2 + luck / 2, plus
// the proficiency bonus with a trained weapon, plus its hit bonus.
export function getHit(unit: CombatStatLine): number {
  return (
    (unit.weapon?.hit ?? 0) +
    (isProficient(unit) ? PROFICIENCY_HIT : 0) +
    (unit.dexterity ?? 0) * 2 +
    Math.floor((unit.luck ?? 0) / 2) +
    (unit.bonus?.hit ?? 0)
  );
}

// How well a unit evades: attack speed × 2 + luck, plus what its light
// armor adds, plus its avoid bonus (terrain bonuses come later).
export function getAvoid(unit: CombatStatLine): number {
  return getAttackSpeed(unit) * 2 + (unit.luck ?? 0) + (unit.armorAvoid ?? 0) + (unit.bonus?.avoid ?? 0);
}

// The attacker's raw crit rate: weapon crit + dexterity / 2, plus the
// proficiency bonus with a trained weapon, plus its crit bonus.
export function getCrit(unit: CombatStatLine): number {
  return (
    (unit.weapon?.crit ?? 0) +
    (isProficient(unit) ? PROFICIENCY_CRIT : 0) +
    Math.floor((unit.dexterity ?? 0) / 2) +
    (unit.bonus?.crit ?? 0)
  );
}

// How well a unit wards off crits: its luck.
export function getDodge(unit: CombatStatLine): number {
  return unit.luck ?? 0;
}

// Chance (0–100) that attacker's strike lands on defender.
export function getHitChance(attacker: CombatStatLine, defender: CombatStatLine): number {
  return clampPercent(getHit(attacker) - getAvoid(defender));
}

// Chance (0–100) that a landed strike from attacker on defender crits.
export function getCritChance(attacker: CombatStatLine, defender: CombatStatLine): number {
  return clampPercent(getCrit(attacker) - getDodge(defender));
}

// Whether unit strikes twice against opponent.
export function canDouble(unit: CombatStatLine, opponent: CombatStatLine): boolean {
  return getAttackSpeed(unit) - getAttackSpeed(opponent) >= DOUBLE_THRESHOLD;
}

// A random whole number from 0 to 99.
function rollPercent(rng: Rng): number {
  return Math.min(99, Math.floor(rng() * 100));
}

// Whether a roll against `chance` (0–100) succeeds. With `trueHit`, the
// roll is the average of two (FE's "2RN"), which makes high rates more
// reliable and low ones less likely than they read.
export function rollChance(chance: number, rng: Rng, { trueHit = false }: { trueHit?: boolean } = {}): boolean {
  const roll = trueHit ? (rollPercent(rng) + rollPercent(rng)) / 2 : rollPercent(rng);
  return roll < chance;
}
