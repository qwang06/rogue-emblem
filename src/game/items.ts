// Pure rules for items. A unit carries an inventory — a frozen list of
// { item, quantity } entries — of consumables, weapons, staves and armor. Using a
// consumable restores one of its stats and uses one up; weapons are
// fought with (see weapons.ts) and staves heal allies (see healing.ts),
// and a weapon or staff entry's quantity is the uses it has left. No Phaser, no rendering, no hidden state.

// A consumable: { kind: 'consumable', id, label, stat, amount }. `stat` is
// what it restores ('health' or 'mana') and `amount` the most it restores
// in one use.

import type { MenuAction } from './actionMenu.ts';
import type { Staff } from './healing.ts';
import type { Weapon } from './weapons.ts';

export type RestoreStat = 'health' | 'mana';

export interface Consumable {
  kind: 'consumable';
  id: string;
  label: string;
  stat: RestoreStat;
  amount: number;
}

// Armor: { kind: 'armor', id, label, slot, defense, weight }. `slot` is
// where it's worn ('shield' on the arm, 'body' on the chest), `defense` what
// it adds to the wearer's defense against physical hits and `weight` what
// it weighs (not counted yet). It's carried like any other item (a slot
// each, never stacking), and a unit wears the first armor of each slot in
// its inventory (getWornArmor); wearing another moves it to the front.
export type ArmorSlot = 'shield' | 'body';

export interface Armor {
  kind: 'armor';
  id: string;
  label: string;
  slot: ArmorSlot;
  defense: number;
  weight: number;
}

export type Item = Consumable | Weapon | Staff | Armor;

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

export const HEALTH_POTION: Consumable = Object.freeze({
  kind: 'consumable',
  id: 'health-potion',
  label: 'Health Potion',
  stat: 'health',
  amount: 5,
});

export const MANA_POTION: Consumable = Object.freeze({
  kind: 'consumable',
  id: 'mana-potion',
  label: 'Mana Potion',
  stat: 'mana',
  amount: 3,
});

// The wooden set's armor, to go with the wooden weapons in weapons.ts.
export const WOODEN_SHIELD: Armor = Object.freeze({
  kind: 'armor',
  id: 'wooden-shield',
  label: 'Wooden Shield',
  slot: 'shield',
  defense: 1,
  weight: 1,
});

export const WOODEN_ARMOR: Armor = Object.freeze({
  kind: 'armor',
  id: 'wooden-armor',
  label: 'Wooden Armor',
  slot: 'body',
  defense: 1,
  weight: 2,
});

export const ARMORS: readonly Armor[] = Object.freeze([WOODEN_SHIELD, WOODEN_ARMOR]);

export function isArmor(item: { kind: string }): item is Armor {
  return item.kind === 'armor';
}

// The armor a unit wears, as [{ armor, index }] in inventory order: the
// first armor of each slot it carries.
export function getWornArmor(inventory: Inventory): { armor: Armor; index: number }[] {
  const worn: { armor: Armor; index: number }[] = [];
  inventory.forEach(({ item }, index) => {
    if (isArmor(item) && !worn.some(({ armor }) => armor.slot === item.slot)) worn.push({ armor: item, index });
  });
  return worn;
}

// What the worn armor adds to defense, all slots together.
export function getArmorDefense(inventory: Inventory): number {
  return getWornArmor(inventory).reduce((total, { armor }) => total + armor.defense, 0);
}

// Wears the armor at `index` by moving its entry to the front of the
// inventory, so it's the first of its slot; everything else keeps its
// order (the equipped weapon is the first one the unit can wield, wherever
// it sits). Throws if there's no armor there.
export function wearArmor(inventory: Inventory, index: number): Inventory {
  const entry = inventory[index];
  if (!entry || !isArmor(entry.item)) throw new Error(`No armor to wear at slot ${index}`);
  if (index === 0) return inventory;
  return Object.freeze([entry, ...inventory.filter((_, i) => i !== index)]);
}

// The potions every unit carries into battle (each class adds its weapon).
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

// Whether item fits: a consumable stacks onto an entry already holding it;
// otherwise (and always for a weapon, which never stacks) it needs a free
// slot.
export function canAddItem(inventory: Inventory, item: Item): boolean {
  const stacks = item.kind === 'consumable' && findItem(inventory, item.id) !== null;
  return stacks || inventory.length < MAX_INVENTORY_SLOTS;
}

// Adds quantity (default 1) of item and returns the new inventory: a
// consumable is stacked onto its entry if there is one, else it goes in a
// new slot at the end — as a weapon always does, with `quantity` as its
// uses left. Throws if it doesn't fit (check canAddItem first) or quantity
// isn't positive.
export function addItem(inventory: Inventory, item: Item, quantity = 1): Inventory {
  if (!(quantity > 0)) throw new Error(`Can't add ${quantity} of ${item.id}`);
  if (!canAddItem(inventory, item)) throw new Error(`No room for ${item.id}: inventory is full`);
  if (item.kind === 'consumable' && findItem(inventory, item.id)) {
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
// amount, capped by how far the stat is below its maximum. Weapons restore
// nothing.
export function getItemRecovery(unit: Restorable, item: Item): number {
  if (item.kind !== 'consumable') return 0;
  const fields = STAT_FIELDS[item.stat] as (typeof STAT_FIELDS)[RestoreStat] | undefined;
  if (!fields) return 0;
  const missing = unit[fields.max] - unit[fields.current];
  return Math.max(0, Math.min(item.amount, missing));
}

// An item is only worth using if it would restore something.
export function canUseItem(unit: Restorable, item: Item): boolean {
  return getItemRecovery(unit, item) > 0;
}

// The consumables in an inventory, in order (weapons left out).
export function getConsumables(inventory: Inventory): (InventoryEntry & { item: Consumable })[] {
  return inventory.filter((entry): entry is InventoryEntry & { item: Consumable } => entry.item.kind === 'consumable');
}

// Entries for the item menu: each consumable with how many are left,
// disabled if it would restore nothing (e.g. a health potion at full
// health). Weapons aren't listed — they're chosen through Attack.
export function getItemActions(unit: Restorable, inventory: Inventory): readonly ItemAction[] {
  return Object.freeze(
    getConsumables(inventory).map(({ item, quantity }) =>
      Object.freeze({
        id: item.id,
        label: item.label,
        quantity,
        disabled: !canUseItem(unit, item),
      }),
    ),
  );
}
