import { describe, expect, it } from 'vitest';
import { createInventory, HEALTH_POTION, MANA_POTION, type Inventory } from './items.ts';
import {
  BALLISTA,
  canWield,
  equipWeapon,
  FIRE,
  FISTS,
  formatWeaponRange,
  getEquippedWeapon,
  getWeaponActions,
  getWeaponReach,
  getWieldableWeapons,
  IRON_BOW,
  IRON_SPEAR,
  isWeapon,
  POWDER_KEG,
  spendWeaponUse,
  WEAPON_DAMAGE_TYPES,
  WEAPON_TYPES,
  WEAPONS,
  weaponEntry,
  type Weapon,
} from './weapons.ts';

const PHYSICAL = ['physical'] as const;
const potion = { item: HEALTH_POTION, quantity: 1 };

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

  it('give fists no might and no limit on uses', () => {
    expect(FISTS).toMatchObject({ type: 'physical', might: 0, hit: 80, weight: 0, uses: null });
  });

  it('keep bows and siege engines off adjacent tiles', () => {
    expect(IRON_BOW.minRange).toBe(2);
    expect(BALLISTA.minRange).toBe(2);
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
  it('starts a weapon with all its uses', () => {
    expect(weaponEntry(IRON_SPEAR)).toEqual({ item: IRON_SPEAR, quantity: 40 });
  });

  it('counts a weapon that never breaks as one', () => {
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

describe('getEquippedWeapon', () => {
  it('is the first weapon the unit can wield', () => {
    const inventory = createInventory([potion, weaponEntry(FIRE), weaponEntry(IRON_SPEAR), weaponEntry(FISTS)]);
    expect(getEquippedWeapon(inventory, PHYSICAL)).toEqual({ weapon: IRON_SPEAR, index: 2, uses: 40 });
    expect(getEquippedWeapon(inventory, ['magical'])).toEqual({ weapon: FIRE, index: 1, uses: 30 });
  });

  it('reports null uses for a weapon that never breaks', () => {
    const inventory = createInventory([weaponEntry(FISTS)]);
    expect(getEquippedWeapon(inventory, PHYSICAL)).toEqual({ weapon: FISTS, index: 0, uses: null });
  });

  it('reads the uses left from the entry', () => {
    const inventory = createInventory([{ item: IRON_SPEAR, quantity: 3 }]);
    expect(getEquippedWeapon(inventory, PHYSICAL)?.uses).toBe(3);
  });

  it('is null with no weapon, or none the unit can wield', () => {
    expect(getEquippedWeapon(createInventory([potion]), PHYSICAL)).toBeNull();
    expect(getEquippedWeapon(createInventory([]), PHYSICAL)).toBeNull();
    expect(getEquippedWeapon(createInventory([weaponEntry(FIRE)]), PHYSICAL)).toBeNull();
  });
});

describe('getWieldableWeapons', () => {
  it('lists the wieldable weapons in inventory order, skipping the rest', () => {
    const inventory = createInventory([weaponEntry(IRON_SPEAR), potion, weaponEntry(FIRE), weaponEntry(IRON_BOW)]);
    expect(getWieldableWeapons(inventory, PHYSICAL).map(({ weapon, index }) => [weapon.id, index])).toEqual([
      ['iron-spear', 0],
      ['iron-bow', 3],
    ]);
  });
});

describe('equipWeapon', () => {
  const inventory = createInventory([weaponEntry(IRON_SPEAR), potion, weaponEntry(IRON_BOW)]);

  it('moves the chosen weapon to the front, keeping the rest in order', () => {
    const next = equipWeapon(inventory, 2, PHYSICAL);
    expect(next.map((e) => e.item.id)).toEqual(['iron-bow', 'iron-spear', 'health-potion']);
    expect(getEquippedWeapon(next, PHYSICAL)?.weapon).toBe(IRON_BOW);
    expect(Object.isFrozen(next)).toBe(true);
  });

  it('leaves the inventory alone when the weapon is already first', () => {
    expect(equipWeapon(inventory, 0, PHYSICAL)).toBe(inventory);
  });

  it('keeps the uses the weapon has left', () => {
    const worn = createInventory([potion, { item: IRON_SPEAR, quantity: 7 }]);
    expect(equipWeapon(worn, 1, PHYSICAL)[0]).toEqual({ item: IRON_SPEAR, quantity: 7 });
  });

  it('does not mutate the inventory', () => {
    equipWeapon(inventory, 2, PHYSICAL);
    expect(inventory.map((e) => e.item.id)).toEqual(['iron-spear', 'health-potion', 'iron-bow']);
  });

  it('throws for a consumable, an empty slot, or a weapon the unit cannot wield', () => {
    expect(() => equipWeapon(inventory, 1, PHYSICAL)).toThrow(/slot 1/);
    expect(() => equipWeapon(inventory, 9, PHYSICAL)).toThrow(/slot 9/);
    expect(() => equipWeapon(inventory, 0, ['magical'])).toThrow(/slot 0/);
  });
});

describe('spendWeaponUse', () => {
  it('takes one use off the weapon', () => {
    const inventory = createInventory([potion, weaponEntry(IRON_SPEAR)]);
    const { inventory: next, broke } = spendWeaponUse(inventory, 1);
    expect(broke).toBe(false);
    expect(next[1]).toEqual({ item: IRON_SPEAR, quantity: 39 });
    expect(inventory[1].quantity).toBe(40);
  });

  it('breaks a weapon on its last use and removes it', () => {
    const inventory = createInventory([{ item: IRON_SPEAR, quantity: 1 }, potion]);
    const { inventory: next, broke } = spendWeaponUse(inventory, 0);
    expect(broke).toBe(true);
    expect(next).toEqual([potion]);
    expect(Object.isFrozen(next)).toBe(true);
  });

  it('never wears out a weapon that never breaks', () => {
    const inventory = createInventory([weaponEntry(FISTS)]);
    const result = spendWeaponUse(inventory, 0);
    expect(result).toEqual({ inventory, broke: false });
  });

  it('throws when there is no weapon in the slot', () => {
    const inventory = createInventory([potion]);
    expect(() => spendWeaponUse(inventory, 0)).toThrow(/slot 0/);
    expect(() => spendWeaponUse(inventory, 3)).toThrow(/slot 3/);
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
  const inventory: Inventory = createInventory([
    weaponEntry(IRON_SPEAR),
    { item: MANA_POTION, quantity: 2 },
    weaponEntry(FIRE),
    { item: IRON_BOW, quantity: 5 },
    weaponEntry(FISTS),
  ]);

  it('lists the wieldable weapons with their numbers and uses left', () => {
    const actions = getWeaponActions(inventory, PHYSICAL, () => true);
    expect(actions.map((a) => a.label)).toEqual(['Iron Spear', 'Iron Bow', 'Fists']);
    expect(actions[1]).toEqual({
      id: 'iron-bow@3',
      label: 'Iron Bow',
      index: 3,
      type: 'physical',
      uses: 5,
      might: 2,
      hit: 80,
      crit: 0,
      weight: 2,
      range: '2',
      disabled: false,
    });
    expect(actions[2].uses).toBeNull();
  });

  it('disables a weapon with nothing in range', () => {
    const hasTarget = (weapon: Weapon) => weapon.minRange === 1;
    expect(getWeaponActions(inventory, PHYSICAL, hasTarget).map((a) => a.disabled)).toEqual([false, true, false]);
  });

  it('gives each entry its own id, even for two of the same weapon', () => {
    const pair = createInventory([weaponEntry(IRON_SPEAR), weaponEntry(IRON_SPEAR)]);
    const ids = getWeaponActions(pair, PHYSICAL, () => true).map((a) => a.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('is empty with no weapon to wield', () => {
    expect(getWeaponActions(createInventory([potion]), PHYSICAL, () => true)).toEqual([]);
  });
});
