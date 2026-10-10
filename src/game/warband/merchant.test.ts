import { describe, expect, it } from 'vitest';
import { HEAL_STAFF } from '../healing.ts';
import { HEALTH_POTION, WOODEN_ARMOR, WOODEN_SHIELD, type Item } from '../items.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import {
  FISTS,
  IRON_SPEAR,
  NATURAL_WEAPON_IDS,
  WOODEN_AXE,
  WOODEN_SPEAR,
  WOODEN_SWORD,
  type Weapon,
} from '../weapons.ts';
import {
  buyItem,
  canBuy,
  canSell,
  DEFAULT_PRICES,
  getItemPrice,
  getPurchaseQuantity,
  getSellPrice,
  ITEM_PRICES,
  MERCHANT_STOCK,
  sellItem,
} from './merchant.ts';
import { createRun, RUN_ITEMS, type ItemSnapshot, type RunState } from './run.ts';

function campRun(gold: number, convoy: ItemSnapshot[] = []): RunState {
  const run = createRun(7, new Map<string, Unit>([['alden', new Soldier({ name: 'Alden', team: 'player' })]]));
  return { ...run, gold, convoy };
}

describe('MERCHANT_STOCK', () => {
  it('sells the wooden set', () => {
    expect(MERCHANT_STOCK).toEqual([
      WOODEN_SWORD.id,
      WOODEN_SPEAR.id,
      WOODEN_AXE.id,
      WOODEN_SHIELD.id,
      WOODEN_ARMOR.id,
    ]);
  });

  it('prices everything it sells and every item a run can hold, but natural weapons and learned spells', () => {
    for (const item of RUN_ITEMS) {
      if (NATURAL_WEAPON_IDS.has(item.id)) expect(getItemPrice(item), item.id).toBe(0);
      else expect(getItemPrice(item), item.id).toBeGreaterThan(0);
    }
    for (const id of MERCHANT_STOCK) expect(ITEM_PRICES[id], id).toBeGreaterThan(0);
  });
});

describe('getItemPrice', () => {
  it('reads the price table', () => {
    expect(getItemPrice(WOODEN_SWORD)).toBe(20);
    expect(getItemPrice(WOODEN_AXE)).toBe(25);
    expect(getItemPrice(WOODEN_SHIELD)).toBe(15);
  });

  it("falls back to the kind's price for an unlisted item", () => {
    const tome: Weapon = { ...WOODEN_SWORD, id: 'new-tome', label: 'New Tome' };
    expect(getItemPrice(tome)).toBe(DEFAULT_PRICES.weapon);
  });

  it('gives a natural weapon no price', () => {
    expect(getItemPrice(FISTS)).toBe(0);
  });
});

describe('getSellPrice', () => {
  it('pays half for a fresh weapon', () => {
    expect(getSellPrice({ itemId: WOODEN_SWORD.id, quantity: 20 })).toBe(10);
  });

  it('pays for the uses left, rounded down', () => {
    expect(getSellPrice({ itemId: WOODEN_SWORD.id, quantity: 10 })).toBe(5);
    expect(getSellPrice({ itemId: WOODEN_AXE.id, quantity: 7 })).toBe(4); // 12.5 * 7 / 20 = 4.375
    expect(getSellPrice({ itemId: WOODEN_SWORD.id, quantity: 1 })).toBe(0);
  });

  it('pays the same for a staff by uses left', () => {
    expect(getSellPrice({ itemId: HEAL_STAFF.id, quantity: HEAL_STAFF.uses })).toBe(20);
  });

  it('pays half for armor and for one of a stack of consumables', () => {
    expect(getSellPrice({ itemId: WOODEN_ARMOR.id, quantity: 1 })).toBe(12);
    expect(getSellPrice({ itemId: HEALTH_POTION.id, quantity: 3 })).toBe(5);
  });

  it('pays nothing for a natural weapon', () => {
    expect(getSellPrice({ itemId: FISTS.id, quantity: 1 })).toBe(0);
  });
});

describe('getPurchaseQuantity', () => {
  it('is a fresh weapon’s uses, or one of anything else', () => {
    expect(getPurchaseQuantity(WOODEN_SPEAR)).toBe(20);
    expect(getPurchaseQuantity(WOODEN_ARMOR)).toBe(1);
    expect(getPurchaseQuantity(HEALTH_POTION)).toBe(1);
  });
});

describe('buyItem', () => {
  it('spends the price and adds a fresh one to the convoy', () => {
    const after = buyItem(campRun(30, [{ itemId: IRON_SPEAR.id, quantity: 5 }]), WOODEN_SWORD.id);
    expect(after.gold).toBe(10);
    expect(after.convoy).toEqual([
      { itemId: IRON_SPEAR.id, quantity: 5 },
      { itemId: WOODEN_SWORD.id, quantity: 20 },
    ]);
    expect(Object.isFrozen(after)).toBe(true);
  });

  it('can spend the last of the gold', () => {
    expect(buyItem(campRun(15), WOODEN_SHIELD.id).gold).toBe(0);
  });

  it("won't overspend", () => {
    const run = campRun(14);
    expect(canBuy(run, WOODEN_SHIELD.id)).toBe(false);
    expect(() => buyItem(run, WOODEN_SHIELD.id)).toThrow(/gold/);
  });

  it("won't sell what isn't in stock", () => {
    const run = campRun(100);
    expect(canBuy(run, IRON_SPEAR.id)).toBe(false);
    expect(() => buyItem(run, IRON_SPEAR.id)).toThrow(/doesn't sell/);
  });

  it('stacks a bought consumable onto the convoy’s', () => {
    const stock = [HEALTH_POTION.id];
    const after = buyItem(campRun(30, [{ itemId: HEALTH_POTION.id, quantity: 2 }]), HEALTH_POTION.id, stock);
    expect(after.convoy).toEqual([{ itemId: HEALTH_POTION.id, quantity: 3 }]);
    expect(after.gold).toBe(20);
  });

  it('leaves the input alone', () => {
    const run = campRun(30);
    buyItem(run, WOODEN_SWORD.id);
    expect(run.gold).toBe(30);
    expect(run.convoy).toEqual([]);
  });

  it('works with a custom item list', () => {
    const club: Item = { ...WOODEN_AXE, id: 'oak-club', label: 'Oak Club' };
    const after = buyItem(campRun(40), 'oak-club', ['oak-club'], [club]);
    expect(after.gold).toBe(40 - DEFAULT_PRICES.weapon);
  });
});

describe('sellItem', () => {
  it('takes the whole entry and pays for its uses left', () => {
    const after = sellItem(campRun(5, [{ itemId: WOODEN_SWORD.id, quantity: 10 }]), 0);
    expect(after.gold).toBe(10);
    expect(after.convoy).toEqual([]);
  });

  it('sells one of a stack of consumables', () => {
    const after = sellItem(campRun(0, [{ itemId: HEALTH_POTION.id, quantity: 2 }]), 0);
    expect(after.gold).toBe(5);
    expect(after.convoy).toEqual([{ itemId: HEALTH_POTION.id, quantity: 1 }]);
  });

  it("can't sell a natural weapon or a missing entry", () => {
    const run = campRun(0, [{ itemId: FISTS.id, quantity: 1 }]);
    expect(canSell(run, 0)).toBe(false);
    expect(() => sellItem(run, 0)).toThrow(/can't be sold/);
    expect(canSell(run, 1)).toBe(false);
    expect(() => sellItem(run, 1)).toThrow(/No convoy item/);
  });

  it('sells for less than it buys for', () => {
    const bought = buyItem(campRun(20), WOODEN_SWORD.id);
    expect(sellItem(bought, 0).gold).toBe(10);
  });
});
