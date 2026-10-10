import { describe, expect, it } from 'vitest';
import { MAX_INVENTORY_SLOTS } from '../items.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { Villager } from '../Villager.ts';
import {
  canEquipInRoster,
  canGiveFromConvoy,
  canStoreInConvoy,
  equipInRoster,
  getEquippedIndex,
  getWornIndices,
  giveFromConvoy,
  isMovable,
  isStackable,
  lookUpItem,
  storeInConvoy,
} from './convoy.ts';
import { createRun, type ItemSnapshot, type RunState } from './run.ts';

// Alden the soldier carries [Iron Spear (40), Health Potion, Mana Potion];
// Cato the villager [Fists, Health Potion, Mana Potion].
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
  it('stores a whole weapon entry with its uses left', () => {
    const run = campRun();
    const spent = {
      ...run,
      roster: run.roster.map((u) =>
        u.id === 'alden' ? { ...u, items: [{ itemId: 'iron-spear', quantity: 12 }, ...u.items.slice(1)] } : u,
      ),
    };
    const after = storeInConvoy(spent, 'alden', 0);
    expect(after.convoy).toEqual([{ itemId: 'iron-spear', quantity: 12 }]);
    expect(itemsOf(after, 'alden').map((e) => e.itemId)).toEqual(['health-potion', 'mana-potion']);
  });

  it('stores one consumable at a time, stacking in the convoy', () => {
    const run = campRun([{ itemId: 'health-potion', quantity: 2 }]);
    const stacked = {
      ...run,
      roster: run.roster.map((u) =>
        u.id === 'alden' ? { ...u, items: [u.items[0], { itemId: 'health-potion', quantity: 2 }] } : u,
      ),
    };
    const after = storeInConvoy(stacked, 'alden', 1);
    expect(after.convoy).toEqual([{ itemId: 'health-potion', quantity: 3 }]);
    expect(itemsOf(after, 'alden')[1]).toEqual({ itemId: 'health-potion', quantity: 1 });
  });

  it('drops the unit entry once its last one is stored', () => {
    const after = storeInConvoy(campRun(), 'alden', 2);
    expect(itemsOf(after, 'alden').map((e) => e.itemId)).toEqual(['iron-spear', 'health-potion']);
    expect(after.convoy).toEqual([{ itemId: 'mana-potion', quantity: 1 }]);
  });

  it('refuses a natural weapon, an empty slot and an unknown unit', () => {
    const run = campRun();
    expect(canStoreInConvoy(run, 'cato', 0)).toBe(false);
    expect(() => storeInConvoy(run, 'cato', 0)).toThrow();
    expect(canStoreInConvoy(run, 'alden', 5)).toBe(false);
    expect(() => storeInConvoy(run, 'alden', 5)).toThrow();
    expect(canStoreInConvoy(run, 'nobody', 0)).toBe(false);
    expect(() => storeInConvoy(run, 'nobody', 0)).toThrow(/No unit/);
  });

  it('leaves the input run alone and returns a frozen one', () => {
    const run = campRun();
    const after = storeInConvoy(run, 'alden', 0);
    expect(run.convoy).toEqual([]);
    expect(itemsOf(run, 'alden')).toHaveLength(3);
    expect(Object.isFrozen(after.convoy)).toBe(true);
    expect(Object.isFrozen(itemsOf(after, 'alden'))).toBe(true);
  });
});

describe('giveFromConvoy', () => {
  it('gives a whole weapon entry, at the end of the inventory', () => {
    const after = giveFromConvoy(campRun([{ itemId: 'iron-axe', quantity: 30 }]), 'alden', 0);
    expect(after.convoy).toEqual([]);
    expect(itemsOf(after, 'alden').at(-1)).toEqual({ itemId: 'iron-axe', quantity: 30 });
  });

  it('gives one consumable, stacking onto the one the unit carries', () => {
    const after = giveFromConvoy(campRun([{ itemId: 'health-potion', quantity: 3 }]), 'alden', 0);
    expect(after.convoy).toEqual([{ itemId: 'health-potion', quantity: 2 }]);
    expect(itemsOf(after, 'alden')[1]).toEqual({ itemId: 'health-potion', quantity: 2 });
  });

  it('needs a free slot for anything that does not stack', () => {
    const run = campRun([
      { itemId: 'iron-axe', quantity: 40 },
      { itemId: 'health-potion', quantity: 1 },
    ]);
    const full = Array.from({ length: MAX_INVENTORY_SLOTS }, (_, i) =>
      i === 0 ? { itemId: 'health-potion', quantity: 1 } : { itemId: 'iron-bow', quantity: 40 },
    );
    const packed = { ...run, roster: run.roster.map((u) => (u.id === 'alden' ? { ...u, items: full } : u)) };
    expect(canGiveFromConvoy(packed, 'alden', 0)).toBe(false);
    expect(() => giveFromConvoy(packed, 'alden', 0)).toThrow(/no room/);
    // A potion still stacks onto the one it carries.
    expect(canGiveFromConvoy(packed, 'alden', 1)).toBe(true);
  });

  it('refuses a missing entry or unit', () => {
    const run = campRun();
    expect(canGiveFromConvoy(run, 'alden', 0)).toBe(false);
    expect(() => giveFromConvoy(run, 'alden', 0)).toThrow();
    expect(canGiveFromConvoy(campRun([{ itemId: 'iron-axe', quantity: 1 }]), 'nobody', 0)).toBe(false);
  });
});

describe('equipping', () => {
  const withBow = (): RunState => giveFromConvoy(campRun([{ itemId: 'iron-bow', quantity: 20 }]), 'alden', 0);

  it('finds the equipped weapon, or null without one', () => {
    expect(getEquippedIndex(campRun(), 'alden')).toBe(0);
    expect(getEquippedIndex(campRun(), 'nobody')).toBeNull();
    expect(getEquippedIndex(storeInConvoy(campRun(), 'alden', 0), 'alden')).toBeNull();
  });

  it('moves a wieldable weapon to the front', () => {
    const run = withBow();
    expect(canEquipInRoster(run, 'alden', 3)).toBe(true);
    const after = equipInRoster(run, 'alden', 3);
    expect(itemsOf(after, 'alden').map((e) => e.itemId)).toEqual([
      'iron-bow',
      'iron-spear',
      'health-potion',
      'mana-potion',
    ]);
    expect(itemsOf(after, 'alden')[0].quantity).toBe(20);
    expect(getEquippedIndex(after, 'alden')).toBe(0);
  });

  it('refuses the equipped weapon, a non-weapon and a weapon the class cannot wield', () => {
    const run = giveFromConvoy(campRun([{ itemId: 'fire', quantity: 30 }]), 'alden', 0);
    expect(canEquipInRoster(run, 'alden', 0)).toBe(false);
    expect(canEquipInRoster(run, 'alden', 1)).toBe(false);
    expect(canEquipInRoster(run, 'alden', 3)).toBe(false);
    expect(() => equipInRoster(run, 'alden', 3)).toThrow();
    expect(canEquipInRoster(run, 'alden', 9)).toBe(false);
  });
});

describe('equipping armor', () => {
  const armored = (): RunState =>
    giveFromConvoy(
      giveFromConvoy(
        campRun([
          { itemId: 'wooden-shield', quantity: 1 },
          { itemId: 'wooden-armor', quantity: 1 },
        ]),
        'alden',
        0,
      ),
      'alden',
      0,
    );

  it('wears the first armor of each slot as soon as it is carried', () => {
    const run = armored();
    expect(itemsOf(run, 'alden').map((e) => e.itemId)).toEqual([
      'iron-spear',
      'health-potion',
      'mana-potion',
      'wooden-shield',
      'wooden-armor',
    ]);
    expect(getWornIndices(run, 'alden')).toEqual([3, 4]);
    expect(canEquipInRoster(run, 'alden', 3)).toBe(false);
    expect(getWornIndices(run, 'nobody')).toEqual([]);
  });

  it('wears a second piece of a slot by moving it to the front', () => {
    const run = giveFromConvoy({ ...armored(), convoy: [{ itemId: 'wooden-shield', quantity: 1 }] }, 'alden', 0);
    expect(canEquipInRoster(run, 'alden', 5)).toBe(true);
    const after = equipInRoster(run, 'alden', 5);
    expect(itemsOf(after, 'alden')[0].itemId).toBe('wooden-shield');
    expect(getWornIndices(after, 'alden')).toEqual([0, 5]);
    // The spear is still the weapon it fights with.
    expect(getEquippedIndex(after, 'alden')).toBe(1);
  });

  it('lets any class wear armor and store it', () => {
    const run = giveFromConvoy(campRun([{ itemId: 'wooden-armor', quantity: 1 }]), 'cato', 0);
    expect(getWornIndices(run, 'cato')).toEqual([3]);
    expect(canStoreInConvoy(run, 'cato', 3)).toBe(true);
    expect(storeInConvoy(run, 'cato', 3).convoy).toEqual([{ itemId: 'wooden-armor', quantity: 1 }]);
  });
});
