// Pure combat formulas: hit, avoid, crit, dodge, doubling, and the dice
// rolls that decide them. Fire Emblem style — every rate is a whole
// percentage, and what a strike actually rolls against is the attacker's
// rate minus the defender's, clamped to 0–100. No Phaser, no hidden
// state; randomness comes in through an injected `rng` (() => [0, 1)).

// Stand-in for a weapon's hit rate until weapons exist: without it the
// stat-only formula leaves most strikes at 0% (a soldier's 7 hit vs 8
// avoid). Weapon hit replaces it in Phase 2.
export const BASE_HIT = 80;
// A crit deals this many times the strike's damage.
export const CRIT_MULTIPLIER = 3;
// A unit strikes twice when its speed beats its opponent's by at least this.
export const DOUBLE_THRESHOLD = 4;

// The stats these formulas read. Missing stats count as 0.
export interface CombatStatLine {
  skill?: number;
  speed?: number;
  luck?: number;
}

// A source of randomness in [0, 1), like Math.random.
export type Rng = () => number;

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// The attacker's raw hit rate: base hit + skill × 2 + luck / 2.
export function getHit(unit: CombatStatLine): number {
  return BASE_HIT + (unit.skill ?? 0) * 2 + Math.floor((unit.luck ?? 0) / 2);
}

// How well a unit evades: speed × 2 + luck (terrain bonuses come later).
export function getAvoid(unit: CombatStatLine): number {
  return (unit.speed ?? 0) * 2 + (unit.luck ?? 0);
}

// The attacker's raw crit rate: skill / 2.
export function getCrit(unit: CombatStatLine): number {
  return Math.floor((unit.skill ?? 0) / 2);
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
  return (unit.speed ?? 0) - (opponent.speed ?? 0) >= DOUBLE_THRESHOLD;
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
