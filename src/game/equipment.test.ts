import { describe, expect, it } from 'vitest';
import {
  canEquip,
  createLoadout,
  equipGear,
  GEAR_SLOTS,
  getArmorDefense,
  getArmorWeight,
  getGearLayout,
  getGearSlot,
  getMainStaff,
  getMainWeapon,
  getWornArmor,
  getWornGear,
  hasHandFree,
  isGear,
  NO_EQUIPMENT,
  unequipGear,
} from './equipment.ts';
import { HEAL_STAFF, staffEntry } from './healing.ts';
import { HEALTH_POTION, MANA_POTION, MASTER_SEAL, WOODEN_ARMOR, WOODEN_SHIELD, type Armor } from './items.ts';
import { BITE, FIRE_SPELL, FISTS, IRON_BOW, IRON_SPEAR, LIGHT, weaponEntry } from './weapons.ts';

const COLLAR: Armor = Object.freeze({
  kind: 'armor',
  id: 'spiked-collar',
  label: 'Spiked Collar',
  slot: 'special',
  defense: 1,
  weight: 0,
  forClass: 'beast',
});
const RING: Armor = Object.freeze({
  kind: 'armor',
  id: 'ring',
  label: 'Ring',
  slot: 'accessory',
  defense: 0,
  weight: 0,
});
const HELM: Armor = Object.freeze({ kind: 'armor', id: 'helm', label: 'Helm', slot: 'head', defense: 2, weight: 1 });

describe('getGearLayout', () => {
  it('gives the monster classes and the elementals the monster layout', () => {
    for (const id of ['beast', 'whelp', 'ram', 'slime', 'goblin', 'dragon', 'fire-elemental']) {
      expect(getGearLayout(id)).toBe('monster');
    }
  });

  it('gives everyone else, and no class, the paper doll', () => {
    for (const id of ['villager', 'soldier', 'archer', 'acolyte', 'siege', null]) {
      expect(getGearLayout(id)).toBe('humanoid');
    }
  });

  it('lists five slots for a humanoid and two for a monster', () => {
    expect(GEAR_SLOTS.humanoid).toEqual(['main', 'off', 'head', 'body', 'accessory']);
    expect(GEAR_SLOTS.monster).toEqual(['special', 'accessory']);
  });
});

describe('isGear and getGearSlot', () => {
  it('counts weapons, staves and armor but not natural weapons, potions or seals', () => {
    expect([IRON_SPEAR, HEAL_STAFF, WOODEN_SHIELD, RING].every(isGear)).toBe(true);
    expect([FISTS, BITE, LIGHT, FIRE_SPELL, HEALTH_POTION, MASTER_SEAL].some(isGear)).toBe(false);
  });

  it('puts weapons and staves in the main hand and armor in its own slot', () => {
    expect(getGearSlot(IRON_SPEAR)).toBe('main');
    expect(getGearSlot(HEAL_STAFF)).toBe('main');
    expect(getGearSlot(WOODEN_SHIELD)).toBe('off');
    expect(getGearSlot(HELM)).toBe('head');
    expect(getGearSlot(WOODEN_ARMOR)).toBe('body');
    expect(getGearSlot(RING)).toBe('accessory');
    expect(getGearSlot(COLLAR)).toBe('special');
  });
});

describe('canEquip', () => {
  it('lets a humanoid wear gear for any of its slots', () => {
    for (const gear of [IRON_SPEAR, HEAL_STAFF, WOODEN_SHIELD, HELM, WOODEN_ARMOR, RING]) {
      expect(canEquip(NO_EQUIPMENT, gear, 'humanoid', 'villager')).toBe(true);
    }
  });

  it('keeps a shield off while the main hand holds a two-handed weapon or a staff', () => {
    expect(canEquip({ main: IRON_BOW }, WOODEN_SHIELD, 'humanoid', 'archer')).toBe(false);
    expect(canEquip({ main: HEAL_STAFF }, WOODEN_SHIELD, 'humanoid', 'acolyte')).toBe(false);
    expect(canEquip({ main: IRON_SPEAR }, WOODEN_SHIELD, 'humanoid', 'soldier')).toBe(true);
  });

  it('lets a monster wear only an accessory and its own class special', () => {
    expect(canEquip(NO_EQUIPMENT, RING, 'monster', 'beast')).toBe(true);
    expect(canEquip(NO_EQUIPMENT, COLLAR, 'monster', 'beast')).toBe(true);
    expect(canEquip(NO_EQUIPMENT, COLLAR, 'monster', 'slime')).toBe(false);
    expect(canEquip(NO_EQUIPMENT, IRON_SPEAR, 'monster', 'beast')).toBe(false);
    expect(canEquip(NO_EQUIPMENT, WOODEN_ARMOR, 'monster', 'beast')).toBe(false);
  });

  it('keeps a humanoid out of the special slot', () => {
    expect(canEquip(NO_EQUIPMENT, COLLAR, 'humanoid', 'beast')).toBe(false);
  });
});

describe('equipGear and unequipGear', () => {
  it('wears gear in its slot and hands back what was there', () => {
    const { equipment, removed } = equipGear({ main: IRON_SPEAR }, IRON_BOW, 'humanoid', 'archer');
    expect(equipment).toEqual({ main: IRON_BOW });
    expect(removed).toEqual([IRON_SPEAR]);
    expect(Object.isFrozen(equipment)).toBe(true);
  });

  it('takes the shield off when a two-handed weapon goes in', () => {
    const { equipment, removed } = equipGear(
      { main: IRON_SPEAR, off: WOODEN_SHIELD, body: WOODEN_ARMOR },
      HEAL_STAFF,
      'humanoid',
      'acolyte',
    );
    expect(equipment).toEqual({ main: HEAL_STAFF, body: WOODEN_ARMOR });
    expect(removed).toEqual([IRON_SPEAR, WOODEN_SHIELD]);
  });

  it("throws on gear the unit can't wear", () => {
    expect(() => equipGear({ main: IRON_BOW }, WOODEN_SHIELD, 'humanoid', 'archer')).toThrow();
  });

  it('empties a slot, handing back what was in it', () => {
    const start = { main: IRON_SPEAR, off: WOODEN_SHIELD };
    expect(unequipGear(start, 'off')).toEqual({ equipment: { main: IRON_SPEAR }, removed: WOODEN_SHIELD });
    expect(unequipGear(start, 'head')).toEqual({ equipment: start, removed: null });
    expect(start).toEqual({ main: IRON_SPEAR, off: WOODEN_SHIELD });
  });
});

describe('reading equipment', () => {
  const equipment = { main: IRON_SPEAR, off: WOODEN_SHIELD, head: HELM, body: WOODEN_ARMOR, accessory: RING };

  it('lists worn gear and armor in slot order', () => {
    expect(getWornGear(equipment)).toEqual([IRON_SPEAR, WOODEN_SHIELD, HELM, WOODEN_ARMOR, RING]);
    expect(getWornArmor(equipment)).toEqual([WOODEN_SHIELD, HELM, WOODEN_ARMOR, RING]);
  });

  it('adds up the armor’s defense and weight', () => {
    expect(getArmorDefense(equipment)).toBe(4);
    expect(getArmorWeight(equipment)).toBe(4);
    expect(getArmorDefense(NO_EQUIPMENT)).toBe(0);
  });

  it('tells the main-hand weapon from a staff', () => {
    expect(getMainWeapon(equipment)).toBe(IRON_SPEAR);
    expect(getMainStaff(equipment)).toBeNull();
    expect(getMainStaff({ main: HEAL_STAFF })).toBe(HEAL_STAFF);
    expect(getMainWeapon({ main: HEAL_STAFF })).toBeNull();
  });

  it('has a hand free when the main hand is empty or one-handed', () => {
    expect(hasHandFree(NO_EQUIPMENT)).toBe(true);
    expect(hasHandFree({ main: IRON_SPEAR })).toBe(true);
    expect(hasHandFree({ main: IRON_BOW })).toBe(false);
    expect(hasHandFree({ main: HEAL_STAFF })).toBe(false);
  });
});

describe('createLoadout', () => {
  it('sorts a kit into equipment, innate attacks and the bag', () => {
    const loadout = createLoadout(
      [
        weaponEntry(LIGHT),
        staffEntry(HEAL_STAFF),
        { item: HEALTH_POTION, quantity: 2 },
        { item: WOODEN_ARMOR, quantity: 1 },
      ],
      'humanoid',
      'acolyte',
    );
    expect(loadout.equipment).toEqual({ main: HEAL_STAFF, body: WOODEN_ARMOR });
    expect(loadout.innate).toEqual([LIGHT]);
    expect(loadout.bag).toEqual([{ item: HEALTH_POTION, quantity: 2 }]);
    expect(loadout.spare).toEqual([]);
  });

  it('equips the first piece for each slot and keeps the rest as spare', () => {
    const loadout = createLoadout(
      [weaponEntry(IRON_SPEAR), weaponEntry(IRON_BOW), { item: MASTER_SEAL, quantity: 1 }],
      'humanoid',
      'soldier',
    );
    expect(loadout.equipment).toEqual({ main: IRON_SPEAR });
    expect(loadout.spare.map(({ item }) => item.id)).toEqual(['iron-bow', 'master-seal']);
  });

  it("spares a shield that doesn't fit beside a two-handed weapon", () => {
    const loadout = createLoadout([weaponEntry(IRON_BOW), { item: WOODEN_SHIELD, quantity: 1 }], 'humanoid', 'archer');
    expect(loadout.equipment).toEqual({ main: IRON_BOW });
    expect(loadout.spare.map(({ item }) => item.id)).toEqual(['wooden-shield']);
  });

  it('keeps a monster’s natural weapon innate and spares gear it has no slot for', () => {
    const loadout = createLoadout([weaponEntry(BITE), weaponEntry(IRON_SPEAR)], 'monster', 'beast');
    expect(loadout.innate).toEqual([BITE]);
    expect(loadout.equipment).toEqual({});
    expect(loadout.spare.map(({ item }) => item.id)).toEqual(['iron-spear']);
  });

  it('fills the bag up to its limit and spares the rest', () => {
    const potions = Array.from({ length: 5 }, (_, i) => ({ item: { ...MANA_POTION, id: `p${i}` }, quantity: 1 }));
    const loadout = createLoadout(potions, 'humanoid', null);
    expect(loadout.bag).toHaveLength(4);
    expect(loadout.spare).toHaveLength(1);
  });
});
