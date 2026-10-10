// Pure combat rules: which tiles a unit can strike, which of those hold a
// valid target, how much damage a hit deals, and how a whole exchange of
// strikes plays out. A unit fights with its equipped weapon (weapons.ts),
// which sets its range, damage type and might. No Phaser, no rendering,
// no hidden state — applying the damage (and spending weapon uses) on a
// Unit is the caller's job.

import { getCell, getDistance, isInBounds } from './grid.ts';
import {
  CRIT_MULTIPLIER,
  canDouble,
  getCritChance,
  getHitChance,
  rollChance,
  type CombatStatLine,
  type Rng,
} from './combatStats.ts';
import type { Grid, Point } from './grid.ts';
import { WEAPON_DAMAGE_TYPES, type Weapon } from './weapons.ts';

export type DamageType = 'physical' | 'magical';
export type CombatSide = 'attacker' | 'defender';

// The weapon numbers combat reads.
export type CombatWeapon = Pick<Weapon, 'type' | 'might' | 'hit' | 'crit' | 'weight' | 'minRange' | 'maxRange'>;

// What the damage formulas read off a unit. Missing stats count as 0; a
// unit without a weapon hits physically with no might. `armorDefense` is
// what its worn armor adds to its defense (see getArmorDefense in items.ts).
export interface DamageStats {
  strength?: number;
  magic?: number;
  defense?: number;
  armorDefense?: number;
  resistance?: number;
  weapon?: Pick<CombatWeapon, 'type' | 'might'> | null;
}

// What reach reads off a unit: its weapon's range, or nothing without one.
export interface StrikeRange {
  weapon?: Pick<CombatWeapon, 'minRange' | 'maxRange'> | null;
}

// Everything a unit brings to a full exchange of strikes: its stats, its
// equipped weapon (null if it has none, so it can't strike), and the uses
// that weapon has left (`weaponUses`; null or missing for one that never
// breaks).
export interface Fighter extends CombatStatLine, DamageStats, StrikeRange {
  health: number;
  weapon?: CombatWeapon | null;
  weaponUses?: number | null;
}

// A fighter as the forecast shows it, health bar and all.
export interface Combatant extends Fighter {
  maxHealth: number;
}

export interface TargetTile extends Point {
  unitId: string;
}

export interface Strike {
  by: CombatSide;
  target: CombatSide;
  damage: number;
  hit: boolean;
  crit: boolean;
  lethal: boolean;
}

export interface CombatResult {
  strikes: Strike[];
  attackerHealth: number;
  defenderHealth: number;
}

export interface ForecastSide {
  health: number;
  maxHealth: number;
  damage: number | null;
  hit: number | null;
  crit: number | null;
  strikes: number;
  counters: boolean;
}

// Every in-bounds tile from minRange to maxRange steps away (orthogonal
// distance, like movement), as [{ x, y }]. The attacker's own tile is never
// included. Terrain and units don't block — attacks aren't paths.
export function getAttackRange(grid: Grid, origin: Point, maxRange: number, minRange = 1): Point[] {
  const tiles: Point[] = [];
  const low = Math.max(1, minRange);
  for (let dy = -maxRange; dy <= maxRange; dy++) {
    for (let dx = -maxRange; dx <= maxRange; dx++) {
      const tile = { x: origin.x + dx, y: origin.y + dy };
      const distance = getDistance(origin, tile);
      if (distance < low || distance > maxRange) continue;
      if (isInBounds(grid, tile.x, tile.y)) tiles.push(tile);
    }
  }
  return tiles;
}

// Every tile a unit could strike from somewhere it can end its move: the
// tiles within attack range of any tile in `stops` (e.g. its movement
// range), leaving out the stops themselves, as [{ x, y }] — the fringe of
// attackable tiles drawn around a unit's move range. No duplicates.
export function getThreatRange(grid: Grid, stops: readonly Point[], maxRange: number, minRange = 1): Point[] {
  const key = ({ x, y }: Point) => `${x},${y}`;
  const seen = new Set(stops.map(key));
  const tiles: Point[] = [];
  for (const stop of stops) {
    for (const tile of getAttackRange(grid, stop, maxRange, minRange)) {
      if (seen.has(key(tile))) continue;
      seen.add(key(tile));
      tiles.push(tile);
    }
  }
  return tiles;
}

// The occupied tiles in attack range whose unit isHostile(unitId) accepts,
// as [{ x, y, unitId }].
export function getAttackTargets(
  grid: Grid,
  origin: Point,
  maxRange: number,
  isHostile: (unitId: string) => boolean,
  minRange = 1,
): TargetTile[] {
  return getAttackRange(grid, origin, maxRange, minRange)
    .map(({ x, y }) => ({ x, y, unitId: getCell(grid, x, y)!.unitId }))
    .filter((tile): tile is TargetTile => !!tile.unitId && isHostile(tile.unitId));
}

// Damage types: which attacker stat powers a hit and which defender stat
// guards against it.
export const DAMAGE_TYPES: Readonly<
  Record<DamageType, { power: 'strength' | 'magic'; guard: 'defense' | 'resistance' }>
> = Object.freeze({
  physical: Object.freeze({ power: 'strength', guard: 'defense' }),
  magical: Object.freeze({ power: 'magic', guard: 'resistance' }),
});

// The kind of hit a unit's attacks deal: its weapon type's (see
// WEAPON_DAMAGE_TYPES), or 'physical' without a weapon. Throws on a weapon
// type it doesn't know.
export function getDamageType(attacker: Pick<DamageStats, 'weapon'>): DamageType {
  const type = attacker.weapon?.type;
  if (type === undefined) return 'physical';
  if (!Object.hasOwn(WEAPON_DAMAGE_TYPES, type)) throw new Error(`Unknown weapon type: ${type}`);
  return WEAPON_DAMAGE_TYPES[type];
}

// Damage one hit deals: strength plus weapon might minus defense (and
// worn armor) for a physical hit, magic plus might minus resistance for a
// magical one, never below zero. Missing stats count as 0.
export function calculateDamage(attacker: DamageStats, defender: DamageStats): number {
  const { power, guard } = DAMAGE_TYPES[getDamageType(attacker)];
  const might = attacker.weapon?.might ?? 0;
  const armor = guard === 'defense' ? (defender.armorDefense ?? 0) : 0;
  return Math.max(0, (attacker[power] ?? 0) + might - (defender[guard] ?? 0) - armor);
}

// Whether a unit can strike something `distance` orthogonal steps away
// with its weapon (from its minRange, at least 1, to its maxRange). A unit
// without a weapon can't strike at all.
export function isInStrikeRange(unit: StrikeRange, distance: number): boolean {
  const { weapon } = unit;
  if (!weapon) return false;
  return distance >= Math.max(1, weapon.minRange) && distance <= weapon.maxRange;
}

// Who strikes, in order, when attacker attacks defender `distance` steps
// away, as a list of 'attacker' / 'defender': the attacker, then the
// defender if the attacker is within its range, then whoever doubles
// (attacker first). Every strike spends a weapon use, hit or miss, so a
// side's strikes past its weapon's last use (`weaponUses`) are dropped —
// its weapon has broken. A side without a weapon never strikes. Ignores
// deaths — resolveCombat stops early on those.
export function getStrikeOrder(
  attacker: CombatStatLine & Pick<Fighter, 'weapon' | 'weaponUses'>,
  defender: CombatStatLine & Pick<Fighter, 'weapon' | 'weaponUses'>,
  distance: number,
): CombatSide[] {
  const counters = isInStrikeRange(defender, distance);
  const order: CombatSide[] = ['attacker'];
  if (counters) order.push('defender');
  if (canDouble(attacker, defender)) order.push('attacker');
  else if (counters && canDouble(defender, attacker)) order.push('defender');

  const usesLeft: Record<CombatSide, number> = {
    attacker: strikesAvailable(attacker),
    defender: strikesAvailable(defender),
  };
  return order.filter((side) => usesLeft[side]-- > 0);
}

// How many strikes a unit's weapon has left in it: none without a weapon,
// endless for one that never breaks.
function strikesAvailable(unit: Pick<Fighter, 'weapon' | 'weaponUses'>): number {
  if (!unit.weapon) return 0;
  return unit.weaponUses ?? Infinity;
}

// One full exchange when attacker strikes defender, following
// getStrikeOrder. Each strike rolls to hit (hit chance from combatStats.ts)
// and, if it lands, to crit (×CRIT_MULTIPLIER damage); a miss deals 0.
// Combat stops as soon as a unit dies. Nothing is mutated — returns
// { strikes, attackerHealth, defenderHealth }, where strikes is the ordered
// list [{ by, target, damage, hit, crit, lethal }] with `by` / `target`
// being 'attacker' or 'defender', for the caller to apply and animate.
// `context.distance` is the orthogonal distance between the two units (the
// attacker is assumed able to reach); `context.rng` (() => [0, 1),
// default Math.random) drives the rolls, and `context.trueHit` switches
// hit rolls to the two-roll average (see rollChance).
export function resolveCombat(
  attacker: Fighter,
  defender: Fighter,
  { distance, rng = Math.random, trueHit = false }: { distance: number; rng?: Rng; trueHit?: boolean },
): CombatResult {
  const health: Record<CombatSide, number> = { attacker: attacker.health, defender: defender.health };
  const units: Record<CombatSide, Fighter> = { attacker, defender };
  const strikes: Strike[] = [];

  for (const by of getStrikeOrder(attacker, defender, distance)) {
    const target: CombatSide = by === 'attacker' ? 'defender' : 'attacker';
    const striker = units[by];
    const struck = units[target];
    const hit = rollChance(getHitChance(striker, struck), rng, { trueHit });
    const crit = hit && rollChance(getCritChance(striker, struck), rng);
    const base = calculateDamage(striker, struck);
    const damage = !hit ? 0 : crit ? base * CRIT_MULTIPLIER : base;
    health[target] = Math.max(0, health[target] - damage);
    const lethal = health[target] === 0;
    strikes.push({ by, target, damage, hit, crit, lethal });
    if (lethal) break;
  }

  return { strikes, attackerHealth: health.attacker, defenderHealth: health.defender };
}

// What an attack would look like before it's made, for the forecast panel:
// per side, its current health, the damage one landed (non-crit) strike
// deals, its hit and crit chances, and how many strikes it gets — the same
// formulas and strike order resolveCombat rolls against, so the preview
// and the outcome can't disagree. Returns { attacker, defender }, each
// { health, maxHealth, damage, hit, crit, strikes, counters }. A defender
// that can't reach the attacker (`counters` false) has damage, hit and
// crit null and 0 strikes. `context.distance` is as in resolveCombat.
export function getCombatForecast(
  attacker: Combatant,
  defender: Combatant,
  { distance }: { distance: number },
): Record<CombatSide, ForecastSide> {
  const order = getStrikeOrder(attacker, defender, distance);
  const side = (unit: Combatant, opponent: Combatant, role: CombatSide): ForecastSide => {
    const strikes = order.filter((by) => by === role).length;
    const acts = strikes > 0;
    return {
      health: unit.health,
      maxHealth: unit.maxHealth,
      damage: acts ? calculateDamage(unit, opponent) : null,
      hit: acts ? getHitChance(unit, opponent) : null,
      crit: acts ? getCritChance(unit, opponent) : null,
      strikes,
      counters: role === 'attacker' || acts,
    };
  };
  return {
    attacker: side(attacker, defender, 'attacker'),
    defender: side(defender, attacker, 'defender'),
  };
}
