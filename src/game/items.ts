// Pure rules for consumable items. A unit carries an inventory — a frozen
// list of { item, quantity } entries — and using an item restores one of
// its stats and uses one up. No Phaser, no rendering, no hidden state.

// An item: { id, label, stat, amount }. `stat` is what it restores
// ('health' or 'mana') and `amount` the most it restores in one use.

import type { MenuAction } from './actionMenu.ts';

export type RestoreStat = 'health' | 'mana';

export interface Item {
  id: string;
  label: string;
  stat: RestoreStat;
  amount: number;
}

export interface InventoryEntry {
  item: Item;
  quantity: number;
}

export type Inventory = readonly InventoryEntry[];

// The stats an item reads to see how much it can restore.
export interface Restorable {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
}

export interface ItemAction extends MenuAction {
  quantity: number;
}

export const HEALTH_POTION: Item = Object.freeze({
  id: 'health-potion',
  label: 'Health Potion',
  stat: 'health',
  amount: 5,
});

export const MANA_POTION: Item = Object.freeze({
  id: 'mana-potion',
  label: 'Mana Potion',
  stat: 'mana',
  amount: 3,
});

// What every soldier carries into battle.
export const STARTING_ITEMS: Inventory = Object.freeze([
  Object.freeze({ item: HEALTH_POTION, quantity: 1 }),
  Object.freeze({ item: MANA_POTION, quantity: 1 }),
]);

// The current/maximum fields on a unit for each stat an item can restore.
const STAT_FIELDS: Readonly<Record<RestoreStat, { current: keyof Restorable; max: keyof Restorable }>> = Object.freeze({
  health: Object.freeze({ current: 'health', max: 'maxHealth' }),
  mana: Object.freeze({ current: 'mana', max: 'maxMana' }),
});

// How many different items a unit can carry: each entry (one item, any
// quantity) takes a slot.
export const MAX_INVENTORY_SLOTS = 6;

// A frozen inventory from [{ item, quantity }], dropping empty entries.
// Throws if more than MAX_INVENTORY_SLOTS entries are left.
export function createInventory(entries: readonly InventoryEntry[] = []): Inventory {
  const kept = entries.filter((entry) => entry.quantity > 0);
  if (kept.length > MAX_INVENTORY_SLOTS) {
    throw new Error(`An inventory holds at most ${MAX_INVENTORY_SLOTS} items, got ${kept.length}`);
  }
  return Object.freeze(kept.map(({ item, quantity }) => Object.freeze({ item, quantity })));
}

// Whether item fits: it stacks onto an entry already holding it, otherwise
// it needs a free slot.
export function canAddItem(inventory: Inventory, item: Item): boolean {
  return findItem(inventory, item.id) !== null || inventory.length < MAX_INVENTORY_SLOTS;
}

// Adds quantity (default 1) of item and returns the new inventory: stacked
// onto its entry if there is one, else in a new slot at the end. Throws if
// it doesn't fit (check canAddItem first) or quantity isn't positive.
export function addItem(inventory: Inventory, item: Item, quantity = 1): Inventory {
  if (!(quantity > 0)) throw new Error(`Can't add ${quantity} of ${item.id}`);
  if (!canAddItem(inventory, item)) throw new Error(`No room for ${item.id}: inventory is full`);
  if (findItem(inventory, item.id)) {
    return createInventory(
      inventory.map((entry) => (entry.item.id === item.id ? { ...entry, quantity: entry.quantity + quantity } : entry)),
    );
  }
  return createInventory([...inventory, { item, quantity }]);
}

// The inventory entry holding itemId, or null.
export function findItem(inventory: Inventory, itemId: string): InventoryEntry | null {
  return inventory.find((entry) => entry.item.id === itemId) ?? null;
}

// Uses up one of itemId and returns the new inventory; an entry that runs
// out is dropped. Throws if the item isn't in the inventory.
export function removeItem(inventory: Inventory, itemId: string): Inventory {
  if (!findItem(inventory, itemId)) {
    throw new Error(`No ${itemId} in inventory`);
  }
  return createInventory(
    inventory.map((entry) => (entry.item.id === itemId ? { ...entry, quantity: entry.quantity - 1 } : entry)),
  );
}

// How much of its stat the item would actually restore on this unit: its
// amount, capped by how far the stat is below its maximum.
export function getItemRecovery(unit: Restorable, item: Item): number {
  const fields = STAT_FIELDS[item.stat] as (typeof STAT_FIELDS)[RestoreStat] | undefined;
  if (!fields) return 0;
  const missing = unit[fields.max] - unit[fields.current];
  return Math.max(0, Math.min(item.amount, missing));
}

// An item is only worth using if it would restore something.
export function canUseItem(unit: Restorable, item: Item): boolean {
  return getItemRecovery(unit, item) > 0;
}

// Entries for the item menu: each item with how many are left, disabled
// if it would restore nothing (e.g. a health potion at full health).
export function getItemActions(unit: Restorable, inventory: Inventory): readonly ItemAction[] {
  return Object.freeze(
    inventory.map(({ item, quantity }) =>
      Object.freeze({
        id: item.id,
        label: item.label,
        quantity,
        disabled: !canUseItem(unit, item),
      }),
    ),
  );
}
