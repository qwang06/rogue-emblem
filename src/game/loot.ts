// Loot: items enemies carry and drop when they're defeated. A stage hands
// some of its enemies an item each (assignLoot); defeating one gives the
// item to the unit that dealt the blow, or sends it to the convoy when that
// unit's bag is full (claimLoot). Which stages drop how many items is a
// table (STAGE_LOOT_DROPS), so later stages can be tuned on their own. A
// loot item isn't part of the enemy's inventory: it never fights with it.
// No Phaser, no rendering, no hidden state.

import type { Rng } from './combatStats.ts';
import { addItem, canAddItem, WOODEN_ARMOR, WOODEN_SHIELD, type Inventory, type Item } from './items.ts';
import { randomItem, shuffle } from './rng.ts';
import { FIRE, WOODEN_AXE, WOODEN_SPEAR, WOODEN_SWORD } from './weapons.ts';

// What an enemy can drop: the wooden set and the Fire tome.
export const LOOT_ITEMS: readonly Item[] = Object.freeze([
  WOODEN_SWORD,
  WOODEN_SPEAR,
  WOODEN_AXE,
  WOODEN_SHIELD,
  WOODEN_ARMOR,
  FIRE,
]);

// How many enemies carry loot in each Warband Mode stage, from stage 1.
// Stages past the end of the table drop nothing.
export const STAGE_LOOT_DROPS: readonly number[] = Object.freeze([1, 1, 1]);

// How many enemies carry loot in `stage` (from 1) under `drops`.
export function getStageLootCount(stage: number, drops: readonly number[] = STAGE_LOOT_DROPS): number {
  return Number.isInteger(stage) && stage >= 1 ? (drops[stage - 1] ?? 0) : 0;
}

// The loot for a stage: `count` of `enemyIds` (picked at random, at most
// all of them) each carrying one item picked at random from `pool`, by
// enemy id. Empty when there's nothing to drop or no one to carry it.
export function assignLoot(
  enemyIds: readonly string[],
  count: number,
  rng: Rng,
  pool: readonly Item[] = LOOT_ITEMS,
): Map<string, Item> {
  if (count <= 0 || pool.length === 0) return new Map();
  const carriers = shuffle(rng, enemyIds).slice(0, count);
  return new Map(carriers.map((id) => [id, randomItem(rng, pool)]));
}

// How many of an item a drop is: a weapon or staff comes with all its uses
// (1 for one that never breaks), anything else is one.
export function getLootQuantity(item: Item): number {
  return 'uses' in item ? (item.uses ?? 1) : 1;
}

// Where a dropped item goes: into the killer's inventory if it has room
// (`stored` false), else the killer's inventory is unchanged and the item
// goes to the convoy (`stored` true).
export function claimLoot(inventory: Inventory, item: Item): { inventory: Inventory; stored: boolean } {
  if (!canAddItem(inventory, item)) return { inventory, stored: true };
  return { inventory: addItem(inventory, item, getLootQuantity(item)), stored: false };
}
