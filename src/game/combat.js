// Pure combat rules: which tiles a unit can strike, which of those hold a
// valid target, how much damage a hit deals, and how a whole exchange of
// strikes plays out. No Phaser, no rendering, no hidden state — applying
// the damage to a Unit is the caller's job.

import { getCell, isInBounds } from './grid.js';
import { CRIT_MULTIPLIER, canDouble, getCritChance, getHitChance, rollChance } from './combatStats.js';

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// Every in-bounds tile from minRange to maxRange steps away (orthogonal
// distance, like movement), as [{ x, y }]. The attacker's own tile is never
// included. Terrain and units don't block — attacks aren't paths.
export function getAttackRange(grid, origin, maxRange, minRange = 1) {
  const tiles = [];
  const low = Math.max(1, minRange);
  for (let dy = -maxRange; dy <= maxRange; dy++) {
    for (let dx = -maxRange; dx <= maxRange; dx++) {
      const tile = { x: origin.x + dx, y: origin.y + dy };
      const distance = manhattan(origin, tile);
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
export function getThreatRange(grid, stops, maxRange, minRange = 1) {
  const key = ({ x, y }) => `${x},${y}`;
  const seen = new Set(stops.map(key));
  const tiles = [];
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
export function getAttackTargets(grid, origin, maxRange, isHostile, minRange = 1) {
  return getAttackRange(grid, origin, maxRange, minRange)
    .map(({ x, y }) => ({ x, y, unitId: getCell(grid, x, y).unitId }))
    .filter(({ unitId }) => unitId && isHostile(unitId));
}

// Damage types: which attacker stat powers a hit and which defender stat
// guards against it.
export const DAMAGE_TYPES = Object.freeze({
  physical: Object.freeze({ power: 'strength', guard: 'defense' }),
  magical: Object.freeze({ power: 'magic', guard: 'resistance' }),
});

// The kind of hit a unit's attacks deal ('physical' unless it says
// otherwise). Throws on a type DAMAGE_TYPES doesn't know.
export function getDamageType(attacker) {
  const type = attacker.damageType ?? 'physical';
  if (!DAMAGE_TYPES[type]) throw new Error(`Unknown damage type: ${type}`);
  return type;
}

// Damage one hit deals: strength minus defense for a physical hit, magic
// minus resistance for a magical one, never below zero. Missing stats
// count as 0.
export function calculateDamage(attacker, defender) {
  const { power, guard } = DAMAGE_TYPES[getDamageType(attacker)];
  return Math.max(0, (attacker[power] ?? 0) - (defender[guard] ?? 0));
}

// Whether a unit with the given range (`range` max, optional `minRange`,
// default 1) can strike something `distance` orthogonal steps away.
export function isInStrikeRange(unit, distance) {
  return distance >= Math.max(1, unit.minRange ?? 1) && distance <= unit.range;
}

// Who strikes, in order, when attacker attacks defender `distance` steps
// away, as a list of 'attacker' / 'defender': the attacker, then the
// defender if the attacker is within its range, then whoever doubles
// (attacker first). Ignores deaths — resolveCombat stops early on those.
export function getStrikeOrder(attacker, defender, distance) {
  const counters = isInStrikeRange(defender, distance);
  const order = ['attacker'];
  if (counters) order.push('defender');
  if (canDouble(attacker, defender)) order.push('attacker');
  else if (counters && canDouble(defender, attacker)) order.push('defender');
  return order;
}

// One full exchange when attacker strikes defender, following
// getStrikeOrder. Each strike rolls to hit (hit chance from combatStats.js)
// and, if it lands, to crit (×CRIT_MULTIPLIER damage); a miss deals 0.
// Combat stops as soon as a unit dies. Nothing is mutated — returns
// { strikes, attackerHealth, defenderHealth }, where strikes is the ordered
// list [{ by, target, damage, hit, crit, lethal }] with `by` / `target`
// being 'attacker' or 'defender', for the caller to apply and animate.
// `context.distance` is the orthogonal distance between the two units (the
// attacker is assumed able to reach); `context.rng` (() => [0, 1),
// default Math.random) drives the rolls, and `context.trueHit` switches
// hit rolls to the two-roll average (see rollChance).
export function resolveCombat(attacker, defender, { distance, rng = Math.random, trueHit = false }) {
  const health = { attacker: attacker.health, defender: defender.health };
  const units = { attacker, defender };
  const strikes = [];

  for (const by of getStrikeOrder(attacker, defender, distance)) {
    const target = by === 'attacker' ? 'defender' : 'attacker';
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
export function getCombatForecast(attacker, defender, { distance }) {
  const order = getStrikeOrder(attacker, defender, distance);
  const side = (unit, opponent, role) => {
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
