import { describe, expect, it } from 'vitest';
import {
  BALLISTA,
  canWield,
  FIRE,
  FISTS,
  formatWeaponRange,
  getWeaponActions,
  getWeaponReach,
  GREAT_AXE,
  STONE_MAUL,
  IRON_AXE,
  IRON_BOW,
  IRON_SPEAR,
  isWeapon,
  POWDER_KEG,
  WEAPON_DAMAGE_TYPES,
  WEAPON_TYPES,
  WEAPONS,
  WOODEN_AXE,
  WOODEN_SPEAR,
  WOODEN_SWORD,
  weaponEntry,
  type Weapon,
} from './weapons.ts';
import { HEALTH_POTION } from './items.ts';

const PHYSICAL = ['physical'] as const;

describe('the starter weapons', () => {
  it('each have a unique id, a known type, and a sane range', () => {
    expect(new Set(WEAPONS.map((w) => w.id)).size).toBe(WEAPONS.length);
    for (const weapon of WEAPONS) {
      expect(WEAPON_TYPES).toContain(weapon.type);
      expect(weapon.minRange).toBeGreaterThanOrEqual(1);
      expect(weapon.maxRange).toBeGreaterThanOrEqual(weapon.minRange);
      expect(weapon.kind).toBe('weapon');
      expect(Object.isFrozen(weapon)).toBe(true);
    }
  });

  it('give fists no power', () => {
    expect(FISTS).toMatchObject({ type: 'physical', power: 0, hit: 80, weight: 0 });
  });

  it('take both hands for bows, the great axe, the stone maul and siege weapons, and one for the rest', () => {
    const twoHanded = WEAPONS.filter((w) => w.hands === 2).map((w) => w.id);
    expect(twoHanded).toEqual([IRON_BOW.id, POWDER_KEG.id, BALLISTA.id, GREAT_AXE.id, STONE_MAUL.id]);
    for (const weapon of [FISTS, IRON_SPEAR, IRON_AXE, FIRE, WOODEN_SWORD, WOODEN_SPEAR, WOODEN_AXE]) {
      expect(weapon.hands, weapon.id).toBe(1);
    }
  });

  it('keep bows and siege engines off adjacent tiles', () => {
    expect(IRON_BOW.minRange).toBe(2);
    expect(BALLISTA.minRange).toBe(2);
  });

  it('include a wooden sword, spear and axe that are lighter than iron and break sooner', () => {
    for (const wooden of [WOODEN_SWORD, WOODEN_SPEAR, WOODEN_AXE]) {
      expect(WEAPONS).toContain(wooden);
      expect(wooden).toMatchObject({ type: 'physical', minRange: 1, maxRange: 1 });
    }
    expect(WOODEN_SPEAR.weight).toBeLessThan(IRON_SPEAR.weight);
    expect(WOODEN_AXE.weight).toBeLessThan(IRON_AXE.weight);
    expect(WOODEN_AXE.power).toBeLessThan(IRON_AXE.power);
    expect(WOODEN_SWORD.hit).toBeGreaterThan(WOODEN_SPEAR.hit);
    expect(WOODEN_SPEAR.hit).toBeGreaterThan(WOODEN_AXE.hit);
  });

  it('cover every weapon type', () => {
    expect(new Set(WEAPONS.map((w) => w.type))).toEqual(new Set(WEAPON_TYPES));
  });
});

describe('WEAPON_DAMAGE_TYPES', () => {
  it('hits physically with physical and siege weapons and magically with magical ones', () => {
    expect(WEAPON_DAMAGE_TYPES).toEqual({ physical: 'physical', magical: 'magical', siege: 'physical' });
  });
});

describe('weaponEntry', () => {
  it('is one of the weapon', () => {
    expect(weaponEntry(IRON_SPEAR)).toEqual({ item: IRON_SPEAR, quantity: 1 });
    expect(weaponEntry(FISTS)).toEqual({ item: FISTS, quantity: 1 });
  });
});

describe('isWeapon', () => {
  it('tells weapons from consumables', () => {
    expect(isWeapon(IRON_SPEAR)).toBe(true);
    expect(isWeapon(HEALTH_POTION)).toBe(false);
  });
});

describe('canWield', () => {
  it('needs the weapon type mastered', () => {
    expect(canWield(PHYSICAL, IRON_SPEAR)).toBe(true);
    expect(canWield(PHYSICAL, FIRE)).toBe(false);
    expect(canWield(['magical', 'siege'], POWDER_KEG)).toBe(true);
  });

  it('wields nothing with no weapon types', () => {
    expect(canWield([], FISTS)).toBe(false);
  });
});

describe('getWeaponReach', () => {
  it('spans the shortest minimum to the longest maximum', () => {
    expect(getWeaponReach([IRON_SPEAR, BALLISTA])).toEqual({ minRange: 1, maxRange: 3 });
    expect(getWeaponReach([IRON_BOW, BALLISTA])).toEqual({ minRange: 2, maxRange: 3 });
  });

  it('is the one weapon range for a single weapon', () => {
    expect(getWeaponReach([FIRE])).toEqual({ minRange: 1, maxRange: 2 });
  });

  it('is null with no weapons', () => {
    expect(getWeaponReach([])).toBeNull();
  });
});

describe('formatWeaponRange', () => {
  it('is one number for a single range and a span otherwise', () => {
    expect(formatWeaponRange(IRON_SPEAR)).toBe('1');
    expect(formatWeaponRange(IRON_BOW)).toBe('2');
    expect(formatWeaponRange(BALLISTA)).toBe('2–3');
  });
});

describe('getWeaponActions', () => {
  const attacks = [IRON_SPEAR, IRON_BOW, FISTS].map((weapon, index) => ({ weapon, index }));

  it('lists the attacks with their numbers', () => {
    const actions = getWeaponActions(attacks, () => true);
    expect(actions.map((a) => a.label)).toEqual(['Iron Spear', 'Iron Bow', 'Fists']);
    expect(actions[1]).toEqual({
      id: 'iron-bow@1',
      itemId: 'iron-bow',
      label: 'Iron Bow',
      index: 1,
      type: 'physical',
      power: 2,
      hit: 80,
      crit: 0,
      weight: 2,
      range: '2',
      disabled: false,
    });
  });

  it('disables a weapon with nothing in range', () => {
    const hasTarget = (weapon: Weapon) => weapon.minRange === 1;
    expect(getWeaponActions(attacks, hasTarget).map((a) => a.disabled)).toEqual([false, true, false]);
  });

  it('gives each entry its own id, even for two of the same weapon', () => {
    const pair = [IRON_SPEAR, IRON_SPEAR].map((weapon, index) => ({ weapon, index }));
    const ids = getWeaponActions(pair, () => true).map((a) => a.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('is empty with no attack', () => {
    expect(getWeaponActions([], () => true)).toEqual([]);
  });
});
