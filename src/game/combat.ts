// Pure combat rules: which tiles a unit can strike, which of those hold a
// valid target, how much damage a hit deals, and how a whole exchange of
// strikes plays out. A unit fights with its equipped weapon (weapons.ts),
// which sets its range, damage type and power, and with whatever its
// modifiers (modifiers.ts) add for the exchange at hand. No Phaser, no rendering,
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
import {
  getCombatBonus,
  hasModifier,
  isConditionMet,
  isWounded,
  sumModifiers,
  type CombatBonus,
  type CombatContext,
  type Modifier,
} from './modifiers.ts';
import { getStatusModifiers, STATUSES, type StatusId } from './statuses.ts';
import { WEAPON_DAMAGE_TYPES, type Weapon } from './weapons.ts';

export type DamageType = 'physical' | 'magical';
export type CombatSide = 'attacker' | 'defender';

// The weapon numbers combat reads.
export type CombatWeapon = Pick<Weapon, 'type' | 'power' | 'hit' | 'crit' | 'weight' | 'minRange' | 'maxRange'>;

// What the damage formulas read off a unit. Missing stats count as 0; a
// unit without a weapon hits physically with no power. `armorDefense` is
// what its worn armor adds to its defense (see getArmorDefense in items.ts),
// and `bonus` what its modifiers add (damage dealt, guard against damage
// taken) for the exchange at hand.
export interface DamageStats {
  strength?: number;
  intelligence?: number;
  defense?: number;
  armorDefense?: number;
  resistance?: number;
  weapon?: Pick<CombatWeapon, 'type' | 'power'> | null;
  bonus?: Partial<CombatBonus>;
}

// What reach reads off a unit: its weapon's range, or nothing without one.
export interface StrikeRange {
  weapon?: Pick<CombatWeapon, 'minRange' | 'maxRange'> | null;
}

// Everything a unit brings to a full exchange of strikes: its stats, its
// equipped weapon (null if it has none, so it can't strike), and the uses
// that weapon has left (`weaponUses`; null or missing for one that never
// breaks). Its `modifiers` (modifiers.ts) and `statuses` (statuses.ts) give it a combat bonus,
// checked against its health (`wounded`) and whether its opponent is a
// `monster`.
export interface Fighter extends CombatStatLine, DamageStats, StrikeRange {
  health: number;
  maxHealth?: number;
  weapon?: CombatWeapon | null;
  weaponUses?: number | null;
  monster?: boolean;
  modifiers?: readonly Modifier[];
  statuses?: readonly StatusId[];
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
  // HP the striker drained back (a `lifesteal` modifier), when any.
  drain?: number;
  // Whether a `finisher` modifier felled the target (its damage counts
  // the rest of the target's HP).
  finished?: boolean;
  // HP the target's `thorns` and `reflect` cost the striker, when any, and
  // whether that felled the striker (which ends the exchange).
  recoil?: number;
  recoilLethal?: boolean;
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

// The health each side is left on if every strike in a forecast lands
// without a crit: the attacker strikes, then the defender, then whoever
// doubles (getStrikeOrder's order, rebuilt from each side's strike count),
// and the exchange stops at the first kill, as resolveCombat's does. The
// forecast panel draws this as the part of each health bar the exchange
// would take. Returns { attacker, defender }.
export function getForecastHealthAfter(forecast: Record<CombatSide, ForecastSide>): Record<CombatSide, number> {
  const health: Record<CombatSide, number> = {
    attacker: forecast.attacker.health,
    defender: forecast.defender.health,
  };
  const order: CombatSide[] = [];
  const rounds = Math.max(forecast.attacker.strikes, forecast.defender.strikes);
  for (let round = 1; round <= rounds; round++) {
    if (forecast.attacker.strikes >= round) order.push('attacker');
    if (forecast.defender.strikes >= round) order.push('defender');
  }
  for (const by of order) {
    const target: CombatSide = by === 'attacker' ? 'defender' : 'attacker';
    health[target] = Math.max(0, health[target] - (forecast[by].damage ?? 0));
    if (health[target] === 0) break;
  }
  return health;
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
  Record<DamageType, { power: 'strength' | 'intelligence'; guard: 'defense' | 'resistance' }>
> = Object.freeze({
  physical: Object.freeze({ power: 'strength', guard: 'defense' }),
  magical: Object.freeze({ power: 'intelligence', guard: 'resistance' }),
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

// Damage one hit deals: strength plus weapon power minus defense (and
// worn armor) for a physical hit, intelligence plus power minus resistance for a
// magical one, plus the attacker's damage bonus and minus the defender's
// guard bonus, never below zero, then scaled by the percent bonuses
// (scaleDamage). Missing stats count as 0.
export function calculateDamage(attacker: DamageStats, defender: DamageStats): number {
  const { power: stat, guard } = DAMAGE_TYPES[getDamageType(attacker)];
  const power = attacker.weapon?.power ?? 0;
  const armor = guard === 'defense' ? (defender.armorDefense ?? 0) : 0;
  const bonus = (attacker.bonus?.damage ?? 0) - (defender.bonus?.guard ?? 0);
  const base = Math.max(0, (attacker[stat] ?? 0) + power + bonus - (defender[guard] ?? 0) - armor);
  return scaleDamage(base, attacker.bonus?.['damage-percent'] ?? 0, defender.bonus?.['guard-percent'] ?? 0);
}

// The most damage a `guard-percent` bonus can take off a hit, in percent.
export const MAX_GUARD_PERCENT = 80;

// `damage` scaled by a `damage-percent` bonus (more dealt) and a
// `guard-percent` one (less taken, up to MAX_GUARD_PERCENT), rounded to
// the nearest point. No bonuses leave it as it is.
export function scaleDamage(damage: number, damagePercent: number, guardPercent: number): number {
  if (damagePercent === 0 && guardPercent === 0) return damage;
  const guard = Math.min(MAX_GUARD_PERCENT, Math.max(0, guardPercent));
  return Math.max(0, Math.round((damage * (100 + Math.max(0, damagePercent)) * (100 - guard)) / 10000));
}

// What the modifier conditions read off a side (see getFighterBonus).
export interface SkillFighter extends DamageStats {
  health?: number;
  maxHealth?: number;
  monster?: boolean;
  modifiers?: readonly Modifier[];
  statuses?: readonly StatusId[];
  movedTiles?: number;
}

// How many debuffs (statuses.ts) a unit carries.
export function countDebuffs(statuses: readonly StatusId[] | undefined): number {
  return (statuses ?? []).filter((id) => STATUSES[id].kind === 'debuff').length;
}

// Where `unit` stands as it fights `opponent`, for the modifier conditions
// (see isConditionMet in modifiers.ts).
export function getFighterContext(unit: SkillFighter, opponent: SkillFighter, attacking: boolean): CombatContext {
  const foeHealth = opponent.health;
  return {
    attacking,
    wounded: unit.health !== undefined && isWounded({ health: unit.health, maxHealth: unit.maxHealth }),
    vsMonster: opponent.monster === true,
    foeWounded: foeHealth !== undefined && isWounded({ health: foeHealth, maxHealth: opponent.maxHealth }),
    foeUnhurt: foeHealth !== undefined && opponent.maxHealth !== undefined && foeHealth >= opponent.maxHealth,
    foeDebuffed: countDebuffs(opponent.statuses) > 0,
    foeMarked: opponent.statuses?.includes('marked') ?? false,
  };
}

// What `unit`'s modifiers and statuses (statuses.ts) add (getCombatBonus)
// as it fights `opponent`, given whether it's `attacking` (see
// getFighterContext), plus its gear effects that count something: crit for
// each of the foe's debuffs (`crit-per-foe-debuff`) and a term for each
// full tenth of its max HP it's missing (`missing-health-bonus`);
// undefined without either.
export function getFighterBonus(
  unit: SkillFighter,
  opponent: SkillFighter,
  attacking: boolean,
): CombatBonus | undefined {
  const modifiers = [...(unit.modifiers ?? []), ...getStatusModifiers(unit.statuses)];
  if (modifiers.length === 0) return undefined;
  const bonus = { ...getCombatBonus(modifiers, getFighterContext(unit, opponent, attacking)) };
  bonus.crit += sumModifiers(modifiers, 'crit-per-foe-debuff') * countDebuffs(opponent.statuses);
  const tenthsMissing = getTenthsMissing(unit);
  if (tenthsMissing > 0) {
    for (const modifier of modifiers) {
      if (modifier.kind === 'missing-health-bonus') bonus[modifier.term] += modifier.amount * tenthsMissing;
    }
  }
  return Object.freeze(bonus);
}

// How many full tenths of its max HP a unit is missing (0 when it has no
// max HP to measure against).
export function getTenthsMissing(unit: { health?: number; maxHealth?: number }): number {
  if (unit.health === undefined || !unit.maxHealth) return 0;
  return Math.floor((Math.max(0, unit.maxHealth - unit.health) * 10) / unit.maxHealth);
}

// `unit` as it fights `opponent` in one exchange, as the attacker or not:
// a plain copy of the stats the formulas read, with `bonus` set to what
// its modifiers add (getFighterBonus). A unit without modifiers comes back
// as it is. Works on a Unit, whose weapon and armor are getters.
// A `sure-hit` with a condition is kept only when it holds.
export function withCombatBonus<T extends Fighter>(unit: T, opponent: Fighter, attacking: boolean): T {
  const bonus = getFighterBonus(unit, opponent, attacking);
  if (!bonus) return unit;
  const context = getFighterContext(unit, opponent, attacking);
  const modifiers = unit.modifiers?.filter(
    (modifier) => modifier.kind !== 'sure-hit' || isConditionMet(modifier.when, context),
  );
  return {
    health: unit.health,
    maxHealth: unit.maxHealth,
    strength: unit.strength,
    intelligence: unit.intelligence,
    dexterity: unit.dexterity,
    speed: unit.speed,
    luck: unit.luck,
    defense: unit.defense,
    armorDefense: unit.armorDefense,
    armorWeight: unit.armorWeight,
    resistance: unit.resistance,
    weapon: unit.weapon,
    weaponUses: unit.weaponUses,
    monster: unit.monster,
    modifiers,
    statuses: unit.statuses,
    bonus,
  } as T;
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
  attacker: CombatStatLine & Pick<Fighter, 'weapon' | 'weaponUses' | 'modifiers'>,
  defender: CombatStatLine & Pick<Fighter, 'weapon' | 'weaponUses' | 'modifiers'>,
  distance: number,
): CombatSide[] {
  const counters = isInStrikeRange(defender, distance);
  const order: CombatSide[] = ['attacker'];
  if (counters) order.push('defender');
  if (doubles(attacker, defender)) order.push('attacker');
  else if (counters && doubles(defender, attacker)) order.push('defender');

  const usesLeft: Record<CombatSide, number> = {
    attacker: strikesAvailable(attacker),
    defender: strikesAvailable(defender),
  };
  return order.filter((side) => usesLeft[side]-- > 0);
}

// Whether `unit` strikes twice against `opponent`: fast enough to
// (canDouble), or with an `always-double` modifier.
function doubles(
  unit: CombatStatLine & Pick<Fighter, 'modifiers'>,
  opponent: CombatStatLine & Pick<Fighter, 'modifiers'>,
): boolean {
  return hasModifier(unit.modifiers, 'always-double') || canDouble(unit, opponent);
}

// `striker`'s hit chance against `struck`: 100 with a `sure-hit` modifier.
export function getStrikeHitChance(striker: Fighter, struck: Fighter): number {
  return hasModifier(striker.modifiers, 'sure-hit') ? 100 : getHitChance(striker, struck);
}

// What `unit`'s crits multiply damage by: its highest `crit-multiplier`
// modifier's, or CRIT_MULTIPLIER.
export function getCritMultiplier(unit: Pick<Fighter, 'modifiers'>): number {
  let multiplier = CRIT_MULTIPLIER;
  for (const modifier of unit.modifiers ?? []) {
    if (modifier.kind === 'crit-multiplier') multiplier = Math.max(multiplier, modifier.amount);
  }
  return multiplier;
}

// How many strikes a unit's weapon has left in it: none without a weapon,
// endless for one that never breaks.
function strikesAvailable(unit: Pick<Fighter, 'weapon' | 'weaponUses'>): number {
  if (!unit.weapon) return 0;
  return unit.weaponUses ?? Infinity;
}

// One full exchange when attacker strikes defender, following
// getStrikeOrder, each side with its modifiers' bonus (withCombatBonus,
// the attacker as `attacking`). Each strike rolls to hit (hit chance from combatStats.ts,
// getStrikeHitChance) and, if it lands, to crit (×getCritMultiplier damage); a miss deals 0.
// A side's procs (modifiers.ts) act on its strikes: a hit that leaves the
// foe at or under its `finisher` percent of max HP fells it, `lifesteal`
// heals the striker that share of the HP it took (up to its max HP, as the
// strike's `drain`), and after each strike `twin-strike` rolls for one
// more by the same side at once, while its weapon has uses left (a twin
// strike can't chain into another). A crit that fells the foe heals an
// `overkill-heal` striker by the damage past the foe's HP (in `drain` too),
// and a landed strike the foe survives costs the striker its recoil
// (getRecoil: thorns and reflect). Combat stops as soon as a unit dies. Nothing is mutated — returns
// { strikes, attackerHealth, defenderHealth }, where strikes is the ordered
// list [{ by, target, damage, hit, crit, lethal }] with `by` / `target`
// being 'attacker' or 'defender', for the caller to apply and animate.
// `context.distance` is the orthogonal distance between the two units (the
// attacker is assumed able to reach); `context.rng` (() => [0, 1),
// default Math.random) drives the rolls, and `context.trueHit` switches
// hit rolls to the two-roll average (see rollChance).
export function resolveCombat(
  baseAttacker: Fighter,
  baseDefender: Fighter,
  { distance, rng = Math.random, trueHit = false }: { distance: number; rng?: Rng; trueHit?: boolean },
): CombatResult {
  const attacker = withCombatBonus(baseAttacker, baseDefender, true);
  const defender = withCombatBonus(baseDefender, baseAttacker, false);
  const health: Record<CombatSide, number> = { attacker: attacker.health, defender: defender.health };
  const units: Record<CombatSide, Fighter> = { attacker, defender };
  const strikes: Strike[] = [];
  const order = getStrikeOrder(attacker, defender, distance);
  const usesLeft: Record<CombatSide, number> = {
    attacker: strikesAvailable(attacker) - order.filter((side) => side === 'attacker').length,
    defender: strikesAvailable(defender) - order.filter((side) => side === 'defender').length,
  };

  // The indexes in `order` of twin strikes, which can't chain.
  const twinAt = new Set<number>();
  for (let i = 0; i < order.length; i++) {
    const by = order[i];
    const target: CombatSide = by === 'attacker' ? 'defender' : 'attacker';
    const striker = units[by];
    const struck = units[target];
    const hit = rollChance(getStrikeHitChance(striker, struck), rng, { trueHit });
    const crit = hit && rollChance(getCritChance(striker, struck), rng);
    const base = calculateDamage(striker, struck);
    let damage = !hit ? 0 : crit ? base * getCritMultiplier(striker) : base;
    let finished = false;
    const left = Math.max(0, health[target] - damage);
    const finisher = sumModifiers(striker.modifiers, 'finisher');
    if (hit && left > 0 && struck.maxHealth !== undefined && left <= (struck.maxHealth * finisher) / 100) {
      damage = health[target];
      finished = true;
    }
    const dealt = Math.min(damage, health[target]);
    const overkill = crit && damage > health[target] ? damage - health[target] : 0;
    health[target] -= dealt;
    const lethal = health[target] === 0;
    const strike: Strike = { by, target, damage, hit, crit, lethal };
    if (finished) strike.finished = true;
    const overkillHeal = lethal && hasModifier(striker.modifiers, 'overkill-heal') ? overkill : 0;
    const drained = Math.floor((dealt * sumModifiers(striker.modifiers, 'lifesteal')) / 100) + overkillHeal;
    const room = striker.maxHealth === undefined ? drained : striker.maxHealth - health[by];
    const drain = Math.max(0, Math.min(drained, room));
    if (drain > 0) {
      health[by] += drain;
      strike.drain = drain;
    }
    strikes.push(strike);
    if (lethal) break;
    const recoil = Math.min(health[by], hit ? getRecoil(struck, dealt, distance) : 0);
    if (recoil > 0) {
      health[by] -= recoil;
      strike.recoil = recoil;
      if (health[by] === 0) {
        strike.recoilLethal = true;
        break;
      }
    }
    const twin = sumModifiers(striker.modifiers, 'twin-strike');
    if (twin > 0 && !twinAt.has(i) && usesLeft[by] > 0 && rollChance(Math.min(100, twin), rng)) {
      usesLeft[by]--;
      order.splice(i + 1, 0, by);
      twinAt.add(i + 1);
    }
  }

  return { strikes, attackerHealth: health.attacker, defenderHealth: health.defender };
}

// What a landed strike that dealt `dealt` to `struck` from `distance` tiles
// costs the striker: `struck`'s thorns from the next tile, plus its reflect
// percent of `dealt` (a reflect naming a status counts only while `struck`
// has it), rounded down. A strike that fells `struck` costs nothing.
export function getRecoil(struck: Pick<Fighter, 'modifiers' | 'statuses'>, dealt: number, distance: number): number {
  let thorns = 0;
  let percent = 0;
  for (const modifier of struck.modifiers ?? []) {
    if (modifier.kind === 'thorns' && distance === 1) thorns += modifier.amount;
    if (modifier.kind === 'reflect' && (!modifier.status || struck.statuses?.includes(modifier.status))) {
      percent += modifier.percent;
    }
  }
  return thorns + Math.floor((dealt * percent) / 100);
}

// What an attack would look like before it's made, for the forecast panel:
// per side, its current health, the damage one landed (non-crit) strike
// deals, its hit and crit chances, and how many strikes it gets — the same
// formulas, modifier bonuses and strike order resolveCombat rolls against, so the preview
// and the outcome can't disagree. Returns { attacker, defender }, each
// { health, maxHealth, damage, hit, crit, strikes, counters }. A defender
// that can't reach the attacker (`counters` false) has damage, hit and
// crit null and 0 strikes. `context.distance` is as in resolveCombat.
export function getCombatForecast(
  baseAttacker: Combatant,
  baseDefender: Combatant,
  { distance }: { distance: number },
): Record<CombatSide, ForecastSide> {
  const attacker = withCombatBonus(baseAttacker, baseDefender, true);
  const defender = withCombatBonus(baseDefender, baseAttacker, false);
  const order = getStrikeOrder(attacker, defender, distance);
  const side = (unit: Combatant, opponent: Combatant, role: CombatSide): ForecastSide => {
    const strikes = order.filter((by) => by === role).length;
    const acts = strikes > 0;
    return {
      health: unit.health,
      maxHealth: unit.maxHealth,
      damage: acts ? calculateDamage(unit, opponent) : null,
      hit: acts ? getStrikeHitChance(unit, opponent) : null,
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
