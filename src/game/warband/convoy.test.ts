import { describe, expect, it } from 'vitest';
import { HEALTH_POTION, MAX_INVENTORY_SLOTS, WOODEN_ARMOR, WOODEN_SHIELD } from '../items.ts';
import { HEAL_STAFF } from '../healing.ts';
import { FIRE, FISTS, IRON_BOW, WOODEN_SPEAR, WOODEN_SWORD } from '../weapons.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { Villager } from '../Villager.ts';
import {
  canCarry,
  canGiveFromConvoy,
  canStoreInConvoy,
  canUnequip,
  getUnitEquipment,
  giveFromConvoy,
  isMovable,
  isStackable,
  isSuitedTo,
  lookUpItem,
  storeInConvoy,
  unequipToConvoy,
} from './convoy.ts';
import { createRun, type EquipmentSnapshot, type ItemSnapshot, type RunState } from './run.ts';

// Alden the soldier wields an Iron Spear; Cato the villager a Wooden Sword
// (and his fists). Both carry a Health Potion and a Mana Potion.
function campRun(convoy: ItemSnapshot[] = []): RunState {
  const run = createRun(
    7,
    new Map<string, Unit>([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['cato', new Villager({ name: 'Cato', team: 'player' })],
    ]),
  );
  return { ...run, convoy };
}

function itemsOf(run: RunState, unitId: string) {
  return run.roster.find((unit) => unit.id === unitId)!.items;
}

function wornBy(run: RunState, unitId: string): EquipmentSnapshot {
  return run.roster.find((unit) => unit.id === unitId)!.equipment!;
}

function withUnit(run: RunState, unitId: string, change: object): RunState {
  return { ...run, roster: run.roster.map((unit) => (unit.id === unitId ? { ...unit, ...change } : unit)) };
}

describe('item kinds', () => {
  it('stacks only consumables', () => {
    expect(isStackable(lookUpItem('health-potion'))).toBe(true);
    expect(isStackable(lookUpItem('iron-spear'))).toBe(false);
    expect(isStackable(lookUpItem('heal-staff'))).toBe(false);
  });

  it('keeps natural weapons with their bodies', () => {
    expect(isMovable(lookUpItem('fists'))).toBe(false);
    expect(isMovable(lookUpItem('iron-axe'))).toBe(true);
    expect(isMovable(lookUpItem('fire-spell'))).toBe(false);
    expect(isMovable(lookUpItem('fire'))).toBe(true);
  });

  it('throws on an unknown item', () => {
    expect(() => lookUpItem('excalibur')).toThrow(/Unknown item/);
  });
});

describe('storeInConvoy', () => {
  it('stores one consumable at a time, stacking in the convoy', () => {
    const run = withUnit(campRun([{ itemId: 'health-potion', quantity: 2 }]), 'alden', {
      items: [{ itemId: 'health-potion', quantity: 2 }],
    });
    const after = storeInConvoy(run, 'alden', 0);
    expect(after.convoy).toEqual([{ itemId: 'health-potion', quantity: 3 }]);
    expect(itemsOf(after, 'alden')).toEqual([{ itemId: 'health-potion', quantity: 1 }]);
  });

  it('drops the bag entry once its last one is stored', () => {
    const after = storeInConvoy(campRun(), 'alden', 1);
    expect(itemsOf(after, 'alden').map((e) => e.itemId)).toEqual(['health-potion']);
    expect(after.convoy).toEqual([{ itemId: 'mana-potion', quantity: 1 }]);
  });

  it('refuses an empty slot and an unknown unit', () => {
    const run = campRun();
    expect(canStoreInConvoy(run, 'alden', 5)).toBe(false);
    expect(() => storeInConvoy(run, 'alden', 5)).toThrow();
    expect(canStoreInConvoy(run, 'nobody', 0)).toBe(false);
    expect(() => storeInConvoy(run, 'nobody', 0)).toThrow(/No unit/);
  });

  it('leaves the input run alone and returns a frozen one', () => {
    const run = campRun();
    const after = storeInConvoy(run, 'alden', 0);
    expect(run.convoy).toEqual([]);
    expect(itemsOf(run, 'alden')).toHaveLength(2);
    expect(Object.isFrozen(after.convoy)).toBe(true);
    expect(Object.isFrozen(itemsOf(after, 'alden'))).toBe(true);
  });
});

describe('giveFromConvoy', () => {
  it('gives one consumable, stacking onto the one the unit carries', () => {
    const after = giveFromConvoy(campRun([{ itemId: 'health-potion', quantity: 3 }]), 'alden', 0);
    expect(after.convoy).toEqual([{ itemId: 'health-potion', quantity: 2 }]);
    expect(itemsOf(after, 'alden')[0]).toEqual({ itemId: 'health-potion', quantity: 2 });
  });

  it('needs a free bag slot for a consumable it does not carry', () => {
    // Only two kinds of potion exist, so four separate Health Potion entries fill the bag.
    const full = Array.from({ length: MAX_INVENTORY_SLOTS }, () => ({ itemId: 'health-potion', quantity: 1 }));
    const packed = withUnit(
      campRun([
        { itemId: 'mana-potion', quantity: 1 },
        { itemId: 'health-potion', quantity: 1 },
      ]),
      'alden',
      { items: full },
    );
    // Four bag slots taken: a new kind of potion has no room, one it holds stacks.
    expect(itemsOf(packed, 'alden')).toHaveLength(MAX_INVENTORY_SLOTS);
    expect(canGiveFromConvoy(packed, 'alden', 0)).toBe(false);
    expect(() => giveFromConvoy(packed, 'alden', 0)).toThrow();
    expect(canGiveFromConvoy(packed, 'alden', 1)).toBe(true);
  });

  it('equips gear in its slot and sends what it displaces to the convoy', () => {
    const after = giveFromConvoy(campRun([{ itemId: 'iron-bow', quantity: 1 }]), 'alden', 0);
    expect(wornBy(after, 'alden')).toEqual({ main: 'iron-bow' });
    expect(after.convoy).toEqual([{ itemId: 'iron-spear', quantity: 1 }]);
    expect(itemsOf(after, 'alden')).toHaveLength(2);
  });

  it('wears armor beside the weapon, any class', () => {
    const after = giveFromConvoy(campRun([{ itemId: 'wooden-armor', quantity: 1 }]), 'cato', 0);
    expect(wornBy(after, 'cato')).toEqual({ main: 'wooden-sword', body: 'wooden-armor' });
    expect(after.convoy).toEqual([]);
  });

  it('takes the shield off when a two-handed weapon goes in', () => {
    const shielded = giveFromConvoy(campRun([{ itemId: 'wooden-shield', quantity: 1 }]), 'alden', 0);
    expect(wornBy(shielded, 'alden')).toEqual({ main: 'iron-spear', off: 'wooden-shield' });
    const bow = giveFromConvoy({ ...shielded, convoy: [{ itemId: 'iron-bow', quantity: 1 }] }, 'alden', 0);
    expect(wornBy(bow, 'alden')).toEqual({ main: 'iron-bow' });
    expect(bow.convoy.map((e) => e.itemId)).toEqual(['iron-spear', 'wooden-shield']);
  });

  it('refuses a shield beside a bow or a staff, and seals', () => {
    for (const main of ['iron-bow', 'heal-staff']) {
      const run = withUnit(campRun([{ itemId: 'wooden-shield', quantity: 1 }]), 'alden', { equipment: { main } });
      expect(canGiveFromConvoy(run, 'alden', 0)).toBe(false);
    }
    expect(canGiveFromConvoy(campRun([{ itemId: 'master-seal', quantity: 1 }]), 'alden', 0)).toBe(false);
  });

  it('refuses a missing entry or unit', () => {
    const run = campRun();
    expect(canGiveFromConvoy(run, 'alden', 0)).toBe(false);
    expect(() => giveFromConvoy(run, 'alden', 0)).toThrow();
    expect(canGiveFromConvoy(campRun([{ itemId: 'iron-axe', quantity: 1 }]), 'nobody', 0)).toBe(false);
  });
});

describe('unequipToConvoy', () => {
  it('takes gear off into the convoy', () => {
    const run = campRun();
    expect(canUnequip(run, 'alden', 'main')).toBe(true);
    const after = unequipToConvoy(run, 'alden', 'main');
    expect(wornBy(after, 'alden')).toEqual({});
    expect(after.convoy).toEqual([{ itemId: 'iron-spear', quantity: 1 }]);
    expect(getUnitEquipment(after.roster[0]).main).toBeUndefined();
  });

  it('refuses an empty slot or an unknown unit', () => {
    const run = campRun();
    expect(canUnequip(run, 'alden', 'head')).toBe(false);
    expect(() => unequipToConvoy(run, 'alden', 'head')).toThrow();
    expect(canUnequip(run, 'nobody', 'main')).toBe(false);
  });
});

describe('canCarry', () => {
  it('needs bag room for a consumable and a wearable slot for gear', () => {
    const run = campRun();
    expect(canCarry(run, 'alden', WOODEN_SWORD.id)).toBe(true);
    expect(canCarry(run, 'alden', HEALTH_POTION.id)).toBe(true);
    expect(canCarry(run, 'alden', 'master-seal')).toBe(false);
    expect(canCarry(run, 'nobody', WOODEN_SWORD.id)).toBe(false);
  });
});

describe('isSuitedTo', () => {
  const run = campRun();

  it('suits a weapon that strikes at the range of the one the unit fights with', () => {
    expect(isSuitedTo(run, 'alden', WOODEN_SPEAR.id)).toBe(true);
    expect(isSuitedTo(run, 'alden', WOODEN_SWORD.id)).toBe(true);
    expect(isSuitedTo(run, 'alden', IRON_BOW.id)).toBe(false);
  });

  it('suits any weapon it is trained in to a unit with an empty main hand', () => {
    expect(isSuitedTo(withUnit(run, 'alden', { equipment: {} }), 'alden', WOODEN_SWORD.id)).toBe(true);
  });

  it("doesn't suit a natural weapon or a magical one to a physical fighter", () => {
    expect(isSuitedTo(run, 'alden', FISTS.id)).toBe(false);
    expect(isSuitedTo(run, 'alden', FIRE.id)).toBe(false);
  });

  it('suits armor to a unit with nothing in its slot', () => {
    expect(isSuitedTo(run, 'alden', WOODEN_ARMOR.id)).toBe(true);
    const armored = withUnit(run, 'alden', { equipment: { main: 'iron-spear', body: WOODEN_ARMOR.id } });
    expect(isSuitedTo(armored, 'alden', WOODEN_ARMOR.id)).toBe(false);
    expect(isSuitedTo(run, 'alden', WOODEN_SHIELD.id)).toBe(true);
  });

  it('suits a staff only to a unit already healing with one, and consumables to nobody', () => {
    expect(isSuitedTo(run, 'alden', HEAL_STAFF.id)).toBe(false);
    const healer = withUnit(run, 'alden', { equipment: { main: HEAL_STAFF.id } });
    expect(isSuitedTo(healer, 'alden', HEAL_STAFF.id)).toBe(true);
    expect(isSuitedTo(run, 'alden', HEALTH_POTION.id)).toBe(false);
    expect(isSuitedTo(run, 'nobody', WOODEN_SPEAR.id)).toBe(false);
  });
});
