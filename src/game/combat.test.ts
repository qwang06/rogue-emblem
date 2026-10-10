import { describe, expect, it } from 'vitest';
import {
  calculateDamage,
  getDamageType,
  getStrikeOrder,
  getAttackRange,
  getAttackTargets,
  getCombatForecast,
  getThreatRange,
  isInStrikeRange,
  resolveCombat,
  type CombatSide,
  type CombatWeapon,
  type Combatant,
  type Fighter,
} from './combat.ts';
import { createGrid, setTerrain, setUnit, type Point } from './grid.ts';
import type { WeaponType } from './weapons.ts';

// A plain test weapon: physical, no might, 80 hit, no crit, no weight,
// range 1 — so a fighter with it reads like its bare stats.
function arms(overrides: Partial<CombatWeapon> = {}): CombatWeapon {
  return { type: 'physical', might: 0, hit: 80, crit: 0, weight: 0, minRange: 1, maxRange: 1, ...overrides };
}

// Rolls 0 every time: every strike with a hit chance above 0 lands, and
// only crits with a crit chance above 0.
const alwaysHit = () => 0;
// Rolls 99 every time: everything below 100% fails.
const alwaysMiss = () => 0.999;
// Plays back the given rolls (as fractions) in order.
const rolls = (...values: number[]) => {
  let i = 0;
  return () => values[i++];
};

// Sorted "x,y" strings so assertions don't depend on iteration order.
function tiles(list: readonly Point[]) {
  return list.map(({ x, y }) => `${x},${y}`).sort();
}

describe('getAttackRange', () => {
  it('covers the four orthogonal neighbors at range 1', () => {
    const grid = createGrid(5, 5, 'grass');
    expect(tiles(getAttackRange(grid, { x: 2, y: 2 }, 1))).toEqual(['1,2', '2,1', '2,3', '3,2']);
  });

  it('never includes the attacker tile', () => {
    const grid = createGrid(5, 5, 'grass');
    expect(tiles(getAttackRange(grid, { x: 2, y: 2 }, 2))).not.toContain('2,2');
  });

  it('forms a diamond at range 2', () => {
    const grid = createGrid(5, 5, 'grass');
    const range = getAttackRange(grid, { x: 2, y: 2 }, 2);
    expect(range).toHaveLength(12);
    expect(tiles(range)).toContain('4,2');
    expect(tiles(range)).toContain('3,3');
    expect(tiles(range)).not.toContain('4,3');
  });

  it('respects a minimum range', () => {
    const grid = createGrid(5, 5, 'grass');
    const range = getAttackRange(grid, { x: 2, y: 2 }, 2, 2);
    expect(tiles(range)).toEqual(['0,2', '1,1', '1,3', '2,0', '2,4', '3,1', '3,3', '4,2']);
  });

  it('clips to the map edge', () => {
    const grid = createGrid(5, 5, 'grass');
    expect(tiles(getAttackRange(grid, { x: 0, y: 0 }, 1))).toEqual(['0,1', '1,0']);
  });

  it('is not blocked by impassable terrain', () => {
    let grid = createGrid(3, 1, 'grass');
    grid = setTerrain(grid, 1, 0, 'water');
    expect(tiles(getAttackRange(grid, { x: 0, y: 0 }, 1))).toEqual(['1,0']);
  });

  it('is empty with zero range', () => {
    const grid = createGrid(5, 5, 'grass');
    expect(getAttackRange(grid, { x: 2, y: 2 }, 0)).toEqual([]);
  });
});

describe('getThreatRange', () => {
  const sortTiles = (tiles: readonly Point[]) => [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);

  it('rings the stops with the tiles in attack range, leaving out the stops', () => {
    const grid = createGrid(5, 5);
    const stops = [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ];
    expect(sortTiles(getThreatRange(grid, stops, 1))).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 1, y: 2 },
      { x: 4, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ]);
  });

  it('lists each tile once even when several stops reach it', () => {
    const grid = createGrid(5, 5);
    const stops = [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
    ];
    const tiles = getThreatRange(grid, stops, 1);
    const keys = tiles.map(({ x, y }) => `${x},${y}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => k === '2,1')).toHaveLength(1);
  });

  it('reaches further with a longer range', () => {
    const grid = createGrid(5, 5);
    expect(getThreatRange(grid, [{ x: 2, y: 2 }], 2)).toHaveLength(12);
  });

  it('stays on the map', () => {
    const grid = createGrid(3, 3);
    expect(sortTiles(getThreatRange(grid, [{ x: 0, y: 0 }], 1))).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

  it('respects a minimum range', () => {
    const grid = createGrid(5, 5);
    const tiles = getThreatRange(grid, [{ x: 2, y: 2 }], 2, 2);
    expect(tiles).toHaveLength(8);
    expect(tiles).not.toContainEqual({ x: 2, y: 1 });
  });

  it('is empty with no stops', () => {
    expect(getThreatRange(createGrid(3, 3), [], 1)).toEqual([]);
  });
});

describe('getAttackTargets', () => {
  const isHostile = (unitId: string) => unitId.startsWith('enemy');

  it('returns hostile units in range', () => {
    let grid = createGrid(5, 5, 'grass');
    grid = setUnit(grid, 2, 2, 'hero');
    grid = setUnit(grid, 2, 3, 'enemy-a');
    expect(getAttackTargets(grid, { x: 2, y: 2 }, 1, isHostile)).toEqual([{ x: 2, y: 3, unitId: 'enemy-a' }]);
  });

  it('ignores allies and empty tiles', () => {
    let grid = createGrid(5, 5, 'grass');
    grid = setUnit(grid, 2, 2, 'hero');
    grid = setUnit(grid, 1, 2, 'ally');
    expect(getAttackTargets(grid, { x: 2, y: 2 }, 1, isHostile)).toEqual([]);
  });

  it('ignores hostile units out of range', () => {
    let grid = createGrid(5, 5, 'grass');
    grid = setUnit(grid, 2, 2, 'hero');
    grid = setUnit(grid, 4, 2, 'enemy-a');
    expect(getAttackTargets(grid, { x: 2, y: 2 }, 1, isHostile)).toEqual([]);
    expect(getAttackTargets(grid, { x: 2, y: 2 }, 2, isHostile)).toEqual([{ x: 4, y: 2, unitId: 'enemy-a' }]);
  });
});

describe('calculateDamage', () => {
  const defender = { defense: 2, resistance: 5 };

  it('is strength minus defense for a physical hit', () => {
    expect(calculateDamage({ strength: 5 }, { defense: 2 })).toBe(3);
    expect(calculateDamage({ strength: 7, magic: 9, weapon: arms() }, defender)).toBe(5);
  });

  it('is magic minus resistance for a magical hit', () => {
    expect(calculateDamage({ strength: 9, magic: 7, weapon: arms({ type: 'magical' }) }, defender)).toBe(2);
  });

  it('hits physically with a siege weapon', () => {
    expect(calculateDamage({ strength: 7, magic: 9, weapon: arms({ type: 'siege' }) }, defender)).toBe(5);
  });

  it("adds the weapon's might to the attack power", () => {
    expect(calculateDamage({ strength: 5, weapon: arms({ might: 3 }) }, { defense: 2 })).toBe(6);
    expect(calculateDamage({ magic: 6, weapon: arms({ type: 'magical', might: 2 }) }, defender)).toBe(3);
  });

  it('never goes below zero', () => {
    expect(calculateDamage({ strength: 1 }, { defense: 4 })).toBe(0);
    expect(calculateDamage({ magic: 3, weapon: arms({ type: 'magical' }) }, defender)).toBe(0);
  });

  it('subtracts worn armor from physical hits only', () => {
    const armored = { defense: 2, armorDefense: 2, resistance: 1 };
    expect(calculateDamage({ strength: 7, weapon: arms() }, armored)).toBe(3);
    expect(calculateDamage({ magic: 7, weapon: arms({ type: 'magical' }) }, armored)).toBe(6);
    expect(calculateDamage({ strength: 3 }, armored)).toBe(0);
  });

  it('counts a missing guard stat as 0', () => {
    expect(calculateDamage({ magic: 4, weapon: arms({ type: 'magical' }) }, { defense: 3 })).toBe(4);
  });
});

describe('getDamageType', () => {
  it('is physical without a weapon', () => {
    expect(getDamageType({})).toBe('physical');
    expect(getDamageType({ weapon: null })).toBe('physical');
  });

  it("follows the weapon's type", () => {
    expect(getDamageType({ weapon: arms() })).toBe('physical');
    expect(getDamageType({ weapon: arms({ type: 'magical' }) })).toBe('magical');
    expect(getDamageType({ weapon: arms({ type: 'siege' }) })).toBe('physical');
  });

  it('throws on an unknown weapon type', () => {
    expect(() => getDamageType({ weapon: arms({ type: 'psychic' as WeaponType }) })).toThrow(/psychic/);
  });
});

describe('resolveCombat damage types', () => {
  it("uses each side's own weapon's damage type", () => {
    const mage: Fighter = {
      health: 10,
      strength: 0,
      magic: 6,
      defense: 1,
      resistance: 4,
      weapon: arms({ type: 'magical' }),
    };
    const knight: Fighter = { health: 10, strength: 6, magic: 0, defense: 8, resistance: 0, weapon: arms() };
    const { strikes } = resolveCombat(mage, knight, { distance: 1, rng: alwaysHit });
    expect(strikes.map((s) => s.damage)).toEqual([6, 5]);
  });
});

describe('isInStrikeRange', () => {
  it('accepts distances from 1 up to range', () => {
    expect(isInStrikeRange({ weapon: arms({ maxRange: 2 }) }, 1)).toBe(true);
    expect(isInStrikeRange({ weapon: arms({ maxRange: 2 }) }, 2)).toBe(true);
    expect(isInStrikeRange({ weapon: arms({ maxRange: 2 }) }, 3)).toBe(false);
  });

  it('respects a minimum range', () => {
    expect(isInStrikeRange({ weapon: arms({ minRange: 2, maxRange: 2 }) }, 1)).toBe(false);
    expect(isInStrikeRange({ weapon: arms({ minRange: 2, maxRange: 2 }) }, 2)).toBe(true);
  });

  it('never strikes without a weapon', () => {
    expect(isInStrikeRange({}, 1)).toBe(false);
    expect(isInStrikeRange({ weapon: null }, 1)).toBe(false);
  });

  it('never strikes its own tile', () => {
    expect(isInStrikeRange({ weapon: arms({ minRange: 0 }) }, 0)).toBe(false);
  });
});

describe('resolveCombat', () => {
  const unit = (stats: Partial<Fighter> = {}): Fighter => ({
    health: 10,
    strength: 5,
    defense: 2,
    weapon: arms(),
    ...stats,
  });

  it('has the defender counter when the attacker is in its range', () => {
    const result = resolveCombat(unit(), unit({ strength: 4 }), { distance: 1, rng: alwaysHit });
    expect(result.strikes).toEqual([
      { by: 'attacker', target: 'defender', damage: 3, hit: true, crit: false, lethal: false },
      { by: 'defender', target: 'attacker', damage: 2, hit: true, crit: false, lethal: false },
    ]);
    expect(result.attackerHealth).toBe(8);
    expect(result.defenderHealth).toBe(7);
  });

  it('has no counter when the attacker is out of the defender range', () => {
    const result = resolveCombat(unit({ weapon: arms({ maxRange: 2 }) }), unit({ weapon: arms() }), {
      distance: 2,
      rng: alwaysHit,
    });
    expect(result.strikes).toHaveLength(1);
    expect(result.strikes[0].by).toBe('attacker');
    expect(result.attackerHealth).toBe(10);
  });

  it('has no counter inside the defender minimum range', () => {
    const result = resolveCombat(unit(), unit({ weapon: arms({ minRange: 2, maxRange: 2 }) }), {
      distance: 1,
      rng: alwaysHit,
    });
    expect(result.strikes).toHaveLength(1);
  });

  it('ends before the counter when the attacker kills', () => {
    const result = resolveCombat(unit({ strength: 20 }), unit(), { distance: 1, rng: alwaysHit });
    expect(result.strikes).toEqual([
      { by: 'attacker', target: 'defender', damage: 18, hit: true, crit: false, lethal: true },
    ]);
    expect(result.defenderHealth).toBe(0);
    expect(result.attackerHealth).toBe(10);
  });

  it('lets the counter kill the attacker', () => {
    const result = resolveCombat(unit({ health: 2 }), unit({ strength: 9 }), { distance: 1, rng: alwaysHit });
    expect(result.strikes[1]).toMatchObject({ by: 'defender', damage: 7, lethal: true });
    expect(result.attackerHealth).toBe(0);
    expect(result.defenderHealth).toBe(7);
  });

  it('plays out a 0-damage exchange without killing anyone', () => {
    const result = resolveCombat(unit({ strength: 1 }), unit({ strength: 1 }), { distance: 1, rng: alwaysHit });
    expect(result.strikes.map((s) => s.damage)).toEqual([0, 0]);
    expect(result.strikes.every((s) => !s.lethal)).toBe(true);
    expect(result.attackerHealth).toBe(10);
    expect(result.defenderHealth).toBe(10);
  });

  it('does not mutate the units', () => {
    const attacker = unit();
    const defender = unit();
    resolveCombat(attacker, defender, { distance: 1, rng: alwaysHit });
    expect(attacker.health).toBe(10);
    expect(defender.health).toBe(10);
  });
});

describe('getStrikeOrder', () => {
  const unit = (stats: Partial<Fighter> = {}) => ({ speed: 5, weapon: arms(), ...stats });

  it('is attacker then defender when neither doubles', () => {
    expect(getStrikeOrder(unit(), unit(), 1)).toEqual(['attacker', 'defender']);
  });

  it('lets a faster attacker strike again last', () => {
    expect(getStrikeOrder(unit({ speed: 9 }), unit(), 1)).toEqual(['attacker', 'defender', 'attacker']);
  });

  it('lets a faster defender strike again last', () => {
    expect(getStrikeOrder(unit(), unit({ speed: 9 }), 1)).toEqual(['attacker', 'defender', 'defender']);
  });

  it('doubles at exactly the threshold but not one short of it', () => {
    expect(getStrikeOrder(unit({ speed: 9 }), unit({ speed: 5 }), 1)).toHaveLength(3);
    expect(getStrikeOrder(unit({ speed: 8 }), unit({ speed: 5 }), 1)).toHaveLength(2);
  });

  it('lets an attacker double even when the defender cannot counter', () => {
    expect(getStrikeOrder(unit({ speed: 9, weapon: arms({ maxRange: 2 }) }), unit(), 2)).toEqual([
      'attacker',
      'attacker',
    ]);
  });

  it('gives a side without a weapon no strikes', () => {
    expect(getStrikeOrder(unit(), unit({ weapon: null, speed: 9 }), 1)).toEqual(['attacker']);
    expect(getStrikeOrder(unit({ weapon: null }), unit(), 1)).toEqual(['defender']);
  });

  it('drops strikes past the last use of a weapon, hit or miss', () => {
    expect(getStrikeOrder(unit({ speed: 9, weaponUses: 1 }), unit(), 1)).toEqual(['attacker', 'defender']);
    expect(getStrikeOrder(unit(), unit({ speed: 9, weaponUses: 1 }), 1)).toEqual(['attacker', 'defender']);
    expect(getStrikeOrder(unit({ speed: 9, weaponUses: 2 }), unit(), 1)).toEqual(['attacker', 'defender', 'attacker']);
    expect(getStrikeOrder(unit(), unit({ weaponUses: 0 }), 1)).toEqual(['attacker']);
  });

  it('never runs out with a weapon that never breaks', () => {
    expect(getStrikeOrder(unit({ speed: 9, weaponUses: null }), unit(), 1)).toHaveLength(3);
  });

  it('slows a unit whose weapon is too heavy for it', () => {
    // Speed 9, but weight 8 against strength 4 costs 4 attack speed: 5 vs 5, no double.
    const heavy = unit({ speed: 9, strength: 4, weapon: arms({ weight: 8 }) });
    expect(getStrikeOrder(heavy, unit(), 1)).toEqual(['attacker', 'defender']);
    expect(getStrikeOrder({ ...heavy, strength: 8 }, unit(), 1)).toHaveLength(3);
  });

  it('never has a defender out of range double', () => {
    expect(getStrikeOrder(unit({ weapon: arms({ maxRange: 2 }) }), unit({ speed: 9 }), 2)).toEqual(['attacker']);
  });
});

describe('resolveCombat rolls', () => {
  // 10 HP, 3 damage per hit; base 80 hit vs 0 avoid, no crit unless skilled.
  const unit = (stats: Partial<Fighter> = {}): Fighter => ({
    health: 10,
    strength: 5,
    defense: 2,
    speed: 0,
    weapon: arms(),
    ...stats,
  });

  it('deals no damage on a miss', () => {
    const result = resolveCombat(unit(), unit(), { distance: 1, rng: alwaysMiss });
    expect(result.strikes).toEqual([
      { by: 'attacker', target: 'defender', damage: 0, hit: false, crit: false, lethal: false },
      { by: 'defender', target: 'attacker', damage: 0, hit: false, crit: false, lethal: false },
    ]);
    expect(result.attackerHealth).toBe(10);
    expect(result.defenderHealth).toBe(10);
  });

  it('rolls each strike separately', () => {
    // Attacker rolls 85 (miss vs 80); defender rolls 10 (hit), then 50 for crit (0% — no crit).
    const result = resolveCombat(unit(), unit(), { distance: 1, rng: rolls(0.85, 0.1, 0.5) });
    expect(result.strikes.map((s) => s.hit)).toEqual([false, true]);
    expect(result.attackerHealth).toBe(7);
  });

  it('triples damage on a crit', () => {
    // skill 20 → crit 10 vs 0 dodge; rolls: hit 0, crit 5.
    const result = resolveCombat(unit({ skill: 20 }), unit(), { distance: 1, rng: rolls(0, 0.05, 0.99) });
    expect(result.strikes[0]).toMatchObject({ hit: true, crit: true, damage: 9 });
  });

  it('can kill with a crit, ending the exchange', () => {
    const result = resolveCombat(unit({ skill: 20 }), unit({ health: 8 }), { distance: 1, rng: alwaysHit });
    expect(result.strikes).toEqual([
      { by: 'attacker', target: 'defender', damage: 9, hit: true, crit: true, lethal: true },
    ]);
    expect(result.defenderHealth).toBe(0);
  });

  it('never crits on a miss', () => {
    // Hit 120 vs avoid 40 = 80%; crit chance 10, but the hit roll misses so
    // the crit roll (0 — would crit) is never taken.
    const result = resolveCombat(unit({ skill: 20 }), unit({ speed: 20, weapon: null }), {
      distance: 1,
      rng: rolls(0.99, 0),
    });
    expect(result.strikes[0]).toMatchObject({ hit: false, crit: false, damage: 0 });
  });

  it('plays a double, which can finish the defender', () => {
    const result = resolveCombat(unit({ speed: 4 }), unit({ health: 6, speed: 0 }), { distance: 1, rng: alwaysHit });
    expect(result.strikes.map((s) => [s.by, s.damage, s.lethal])).toEqual([
      ['attacker', 3, false],
      ['defender', 3, false],
      ['attacker', 3, true],
    ]);
    expect(result.defenderHealth).toBe(0);
  });

  it('lets a doubling defender kill the attacker', () => {
    const result = resolveCombat(unit({ health: 6 }), unit({ speed: 4 }), { distance: 1, rng: alwaysHit });
    expect(result.strikes.map((s) => s.by)).toEqual(['attacker', 'defender', 'defender']);
    expect(result.attackerHealth).toBe(0);
    expect(result.strikes[2].lethal).toBe(true);
  });

  it('can miss every strike of a doubled exchange', () => {
    const result = resolveCombat(unit({ speed: 4 }), unit(), { distance: 1, rng: alwaysMiss });
    expect(result.strikes).toHaveLength(3);
    expect(result.strikes.every((s) => !s.hit && s.damage === 0)).toBe(true);
  });

  it('never hits at 0% even on the lowest roll', () => {
    const result = resolveCombat(unit(), unit({ speed: 50 }), { distance: 1, rng: alwaysHit });
    expect(result.strikes[0].hit).toBe(false);
  });

  it('passes trueHit through to the hit roll', () => {
    // 80% hit; rolls 90 and 60 average to 75 — a hit with 2RN, a miss without.
    const order = [0.9, 0.6];
    const twoRn = resolveCombat(unit(), unit({ weapon: null }), {
      distance: 1,
      rng: rolls(...order, 0.99),
      trueHit: true,
    });
    const oneRn = resolveCombat(unit(), unit({ weapon: null }), { distance: 1, rng: rolls(...order) });
    expect(twoRn.strikes[0].hit).toBe(true);
    expect(oneRn.strikes[0].hit).toBe(false);
  });
});

describe('getCombatForecast', () => {
  // 20 HP so nobody dies mid-exchange; base 80 hit + skill, no crit unless skilled.
  const unit = (stats: Partial<Combatant> = {}): Combatant => ({
    health: 20,
    maxHealth: 20,
    strength: 5,
    defense: 2,
    skill: 0,
    speed: 0,
    luck: 0,
    weapon: arms(),
    ...stats,
  });

  // The strikes resolveCombat deals per side when every strike lands.
  function landedStrikes(attacker: Combatant, defender: Combatant, distance: number) {
    const { strikes } = resolveCombat(attacker, defender, {
      distance,
      rng: alwaysHit,
    });
    const of = (by: CombatSide) => strikes.filter((s) => s.by === by);
    return { attacker: of('attacker'), defender: of('defender') };
  }

  it('shows both sides of a plain exchange', () => {
    const forecast = getCombatForecast(unit({ skill: 4 }), unit({ strength: 4, speed: 3 }), { distance: 1 });
    expect(forecast.attacker).toEqual({
      health: 20,
      maxHealth: 20,
      damage: 3,
      hit: 82, // 80 + 8 hit − 6 avoid
      crit: 2,
      strikes: 1,
      counters: true,
    });
    expect(forecast.defender).toEqual({
      health: 20,
      maxHealth: 20,
      damage: 2,
      hit: 80,
      crit: 0,
      strikes: 1,
      counters: true,
    });
  });

  it('matches what resolveCombat deals when every strike lands', () => {
    const cases: [Combatant, Combatant, number][] = [
      [unit(), unit({ strength: 4 }), 1],
      [unit({ speed: 9 }), unit(), 1], // attacker doubles
      [unit(), unit({ speed: 9, strength: 7 }), 1], // defender doubles
      [unit({ weapon: arms({ maxRange: 2 }), speed: 9 }), unit(), 2], // no counter, attacker doubles
      [unit({ strength: 1 }), unit({ strength: 1 }), 1], // 0 damage
    ];
    for (const [attacker, defender, distance] of cases) {
      const forecast = getCombatForecast(attacker, defender, { distance });
      const landed = landedStrikes(attacker, defender, distance);
      for (const side of ['attacker', 'defender'] as const) {
        expect(landed[side]).toHaveLength(forecast[side].strikes);
        for (const strike of landed[side]) expect(strike.damage).toBe(forecast[side].damage);
      }
    }
  });

  it('matches crit damage as damage × CRIT_MULTIPLIER', () => {
    const attacker = unit({ skill: 10 }); // 5% crit, rolled as 0 → crits
    const forecast = getCombatForecast(attacker, unit(), { distance: 1 });
    const { strikes } = resolveCombat(attacker, unit(), {
      distance: 1,
      rng: alwaysHit,
    });
    expect(strikes[0]).toMatchObject({
      crit: true,
      damage: forecast.attacker.damage! * 3,
    });
  });

  it('shows nothing for a defender that cannot counter', () => {
    const forecast = getCombatForecast(unit({ weapon: arms({ maxRange: 2 }) }), unit({ speed: 9 }), {
      distance: 2,
    });
    expect(forecast.defender).toEqual({
      health: 20,
      maxHealth: 20,
      damage: null,
      hit: null,
      crit: null,
      strikes: 0,
      counters: false,
    });
    expect(forecast.attacker.strikes).toBe(1);
  });

  it('counts two strikes for a doubling side', () => {
    expect(getCombatForecast(unit({ speed: 4 }), unit(), { distance: 1 }).attacker.strikes).toBe(2);
    expect(getCombatForecast(unit(), unit({ speed: 4 }), { distance: 1 }).defender.strikes).toBe(2);
  });

  it('changes with the weapon the attacker fights with', () => {
    const defender = unit({ speed: 3 });
    const spear = getCombatForecast(unit({ weapon: arms({ might: 1, hit: 80 }) }), defender, { distance: 1 });
    const axe = getCombatForecast(unit({ weapon: arms({ might: 3, hit: 65, weight: 7 }) }), defender, {
      distance: 1,
    });
    const bow = getCombatForecast(unit({ weapon: arms({ might: 2, minRange: 2, maxRange: 2 }) }), defender, {
      distance: 2,
    });
    expect([spear.attacker.damage, spear.attacker.hit, spear.defender.hit]).toEqual([4, 74, 80]);
    // Weight 7 against strength 5 costs 2 attack speed, so 4 less avoid.
    expect([axe.attacker.damage, axe.attacker.hit, axe.defender.hit]).toEqual([6, 59, 84]);
    expect([bow.attacker.damage, bow.defender.counters]).toEqual([5, false]);
  });

  it('agrees with resolveCombat when a weapon breaks mid-exchange', () => {
    const attacker = unit({ speed: 9, weaponUses: 1 });
    const forecast = getCombatForecast(attacker, unit(), { distance: 1 });
    const landed = landedStrikes(attacker, unit(), 1);
    expect(forecast.attacker.strikes).toBe(1);
    expect(landed.attacker).toHaveLength(1);
  });

  it('clamps hit to 0–100', () => {
    const forecast = getCombatForecast(unit({ skill: 20 }), unit({ skill: 20, speed: 70 }), { distance: 1 });
    expect(forecast.attacker.hit).toBe(0);
    expect(forecast.defender.hit).toBe(100);
  });

  it('does not mutate the units', () => {
    const attacker = unit();
    const defender = unit();
    getCombatForecast(attacker, defender, { distance: 1 });
    expect(attacker).toEqual(unit());
    expect(defender).toEqual(unit());
  });
});
