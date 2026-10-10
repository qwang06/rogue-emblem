import { describe, expect, it } from 'vitest';
import { createInventory, HEALTH_POTION, MAX_INVENTORY_SLOTS, WOODEN_ARMOR, WOODEN_SHIELD } from './items.ts';
import { assignLoot, claimLoot, getLootQuantity, getStageLootCount, LOOT_ITEMS, STAGE_LOOT_DROPS } from './loot.ts';
import { createSeededRng } from './rng.ts';
import { FISTS, IRON_SPEAR, WOODEN_AXE, WOODEN_SPEAR, WOODEN_SWORD } from './weapons.ts';

describe('LOOT_ITEMS', () => {
  it('is the wooden set', () => {
    expect(LOOT_ITEMS.map((item) => item.id)).toEqual([
      'wooden-sword',
      'wooden-spear',
      'wooden-axe',
      'wooden-shield',
      'wooden-armor',
    ]);
  });
});

describe('getStageLootCount', () => {
  it('drops one item in each of the first three stages', () => {
    expect([1, 2, 3].map((stage) => getStageLootCount(stage))).toEqual([1, 1, 1]);
    expect(STAGE_LOOT_DROPS).toEqual([1, 1, 1]);
  });

  it('drops nothing past the end of the table', () => {
    expect(getStageLootCount(4)).toBe(0);
    expect(getStageLootCount(50)).toBe(0);
  });

  it('reads a custom table', () => {
    expect(getStageLootCount(2, [0, 3])).toBe(3);
    expect(getStageLootCount(1, [0, 3])).toBe(0);
  });

  it('drops nothing for a stage that is not a whole number from 1', () => {
    expect(getStageLootCount(0)).toBe(0);
    expect(getStageLootCount(-1)).toBe(0);
    expect(getStageLootCount(1.5)).toBe(0);
  });
});

describe('assignLoot', () => {
  const ENEMIES = ['enemy-1', 'enemy-2', 'enemy-3', 'enemy-4'];

  it('gives exactly `count` enemies an item from the pool', () => {
    for (let seed = 0; seed < 20; seed++) {
      const loot = assignLoot(ENEMIES, 1, createSeededRng(seed));
      expect(loot.size).toBe(1);
      const [[id, item]] = [...loot];
      expect(ENEMIES).toContain(id);
      expect(LOOT_ITEMS).toContain(item);
    }
  });

  it('gives different enemies when asked for several', () => {
    const loot = assignLoot(ENEMIES, 3, createSeededRng(7));
    expect(loot.size).toBe(3);
  });

  it('gives every enemy one when asked for more than there are', () => {
    const loot = assignLoot(ENEMIES.slice(0, 2), 5, createSeededRng(1));
    expect([...loot.keys()].sort()).toEqual(['enemy-1', 'enemy-2']);
  });

  it('is the same for the same seed', () => {
    expect([...assignLoot(ENEMIES, 2, createSeededRng(42))]).toEqual([...assignLoot(ENEMIES, 2, createSeededRng(42))]);
  });

  it('spreads its picks over the enemies and the pool', () => {
    const carriers = new Set<string>();
    const items = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const [[id, item]] = [...assignLoot(ENEMIES, 1, createSeededRng(seed))];
      carriers.add(id);
      items.add(item.id);
    }
    expect(carriers.size).toBe(ENEMIES.length);
    expect(items.size).toBe(LOOT_ITEMS.length);
  });

  it('gives nothing for a count of zero, no enemies, or an empty pool', () => {
    expect(assignLoot(ENEMIES, 0, createSeededRng(1)).size).toBe(0);
    expect(assignLoot([], 1, createSeededRng(1)).size).toBe(0);
    expect(assignLoot(ENEMIES, 1, createSeededRng(1), []).size).toBe(0);
  });
});

describe('getLootQuantity', () => {
  it('is a weapon’s full uses', () => {
    expect(getLootQuantity(WOODEN_SWORD)).toBe(20);
    expect(getLootQuantity(IRON_SPEAR)).toBe(IRON_SPEAR.uses);
  });

  it('is one for a weapon that never breaks, armor or a consumable', () => {
    expect(getLootQuantity(FISTS)).toBe(1);
    expect(getLootQuantity(WOODEN_SHIELD)).toBe(1);
    expect(getLootQuantity(HEALTH_POTION)).toBe(1);
  });
});

describe('claimLoot', () => {
  it('puts the item at the end of an inventory with room', () => {
    const inventory = createInventory([{ item: HEALTH_POTION, quantity: 1 }]);
    const { inventory: after, stored } = claimLoot(inventory, WOODEN_AXE);
    expect(stored).toBe(false);
    expect(after.map(({ item, quantity }) => [item.id, quantity])).toEqual([
      ['health-potion', 1],
      ['wooden-axe', 20],
    ]);
  });

  it('fills the last free slot', () => {
    const inventory = createInventory(
      Array.from({ length: MAX_INVENTORY_SLOTS - 1 }, () => ({ item: WOODEN_SPEAR, quantity: 3 })),
    );
    const { inventory: after, stored } = claimLoot(inventory, WOODEN_ARMOR);
    expect(stored).toBe(false);
    expect(after).toHaveLength(MAX_INVENTORY_SLOTS);
    expect(after.at(-1)).toEqual({ item: WOODEN_ARMOR, quantity: 1 });
  });

  it('sends the item to the convoy from a full inventory, leaving it alone', () => {
    const inventory = createInventory(
      Array.from({ length: MAX_INVENTORY_SLOTS }, () => ({ item: WOODEN_SPEAR, quantity: 3 })),
    );
    const result = claimLoot(inventory, WOODEN_SWORD);
    expect(result.stored).toBe(true);
    expect(result.inventory).toBe(inventory);
  });
});
