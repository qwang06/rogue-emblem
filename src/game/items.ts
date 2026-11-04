// Pure rules for items: consumables, weapons (weapons.ts), staves
// (healing.ts), armor and seals. A unit's bag is an inventory — a frozen
// list of { item, quantity } entries — of consumables; using one restores
// one of its stats and uses one up. Gear is worn in slots instead (see
// equipment.ts) and the convoy holds the rest. No Phaser, no rendering, no
// hidden state.

// A consumable: { kind: 'consumable', id, label, stat, amount }. `stat` is
// what it restores ('health' or 'mana') and `amount` the most it restores
// in one use.

import type { MenuAction } from './actionMenu.ts';
import type { Curse } from './curses.ts';
import type { Modifier } from './modifiers.ts';
import type { Staff } from './healing.ts';
import type { Weapon } from './weapons.ts';
import { LADDER_ARMORS } from './gearLadder.ts';

export type RestoreStat = 'health' | 'mana';

export interface Consumable {
  kind: 'consumable';
  id: string;
  label: string;
  stat: RestoreStat;
  amount: number;
}

// Armor: { kind: 'armor', id, label, slot, defense, weight }. `slot` is
// where it's worn (see equipment.ts): 'shield' in the off hand (only with a
// one-handed weapon or none), 'head', 'body', 'accessory', or 'special', a
// monster's slot, which only takes gear made for its class (`forClass`).
// `defense` is what it adds to the wearer's defense against physical hits
// and `weight` what it weighs (it slows a wearer weaker than it, along with
// the weapon; see getAttackSpeed in combatStats.ts).
export type ArmorSlot = 'shield' | 'head' | 'body' | 'accessory' | 'special';

export interface Armor {
  kind: 'armor';
  id: string;
  label: string;
  slot: ArmorSlot;
  defense: number;
  weight: number;
  // How heavy it is to wear (body and head armor, see ArmorWeight).
  weightClass?: ArmorWeight;
  // What light armor adds to avoid, and cloth to resistance.
  avoid?: number;
  resistance?: number;
  // For 'special' gear: the class id it's made for.
  forClass?: string;
  // What wearing it adds (modifiers.ts) and costs (curses.ts), for gear
  // that bends a rule; see getGearModifiers in equipment.ts.
  modifiers?: readonly Modifier[];
  curses?: readonly Curse[];
}

// Body and head armor come in three weights: heavy (plate and helms: the
// most DEF, and heavy), light (leather: some DEF and avoid, light) and
// cloth (robes and hats: little DEF, but RES, and weightless).
export type ArmorWeight = 'heavy' | 'light' | 'cloth';

export const ARMOR_WEIGHT_LABELS: Readonly<Record<ArmorWeight, string>> = Object.freeze({
  heavy: 'Heavy',
  light: 'Light',
  cloth: 'Cloth',
});

// A seal: { kind: 'seal', id, label }. Spent at camp to promote a unit
// (see promotions.ts and warband/promotion.ts); it does nothing in battle
// and takes a slot like a weapon, never stacking.
export interface Seal {
  kind: 'seal';
  id: string;
  label: string;
}

export type Item = Consumable | Weapon | Staff | Armor | Seal;

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
  weightClass: 'heavy',
});

// Every armor piece: the wooden set, then the rest of the ladder (gearLadder.ts).
export const ARMORS: readonly Armor[] = Object.freeze([WOODEN_SHIELD, WOODEN_ARMOR, ...LADDER_ARMORS]);

export const MASTER_SEAL: Seal = Object.freeze({ kind: 'seal', id: 'master-seal', label: 'Master Seal' });

export function isArmor(item: { kind: string }): item is Armor {
  return item.kind === 'armor';
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

// How many different consumables a unit's bag holds: each entry (one item,
// any quantity) takes a slot. Gear is worn, not carried (equipment.ts).
export const MAX_INVENTORY_SLOTS = 4;

// A frozen inventory from [{ item, quantity }], dropping empty entries.
// Throws if more than `limit` (MAX_INVENTORY_SLOTS) entries are left.
export function createInventory(entries: readonly InventoryEntry[] = [], limit = MAX_INVENTORY_SLOTS): Inventory {
  const kept = entries.filter((entry) => entry.quantity > 0);
  if (kept.length > limit) {
    throw new Error(`An inventory holds at most ${limit} items, got ${kept.length}`);
  }
  return Object.freeze(kept.map(({ item, quantity }) => Object.freeze({ item, quantity })));
}

// Whether item fits in a bag: only consumables go in one, stacking onto
// an entry already holding it or taking a free slot.
export function canAddItem(inventory: Inventory, item: Item): boolean {
  if (item.kind !== 'consumable') return false;
  return findItem(inventory, item.id) !== null || inventory.length < MAX_INVENTORY_SLOTS;
}

// Adds quantity (default 1) of item and returns the new inventory: a
// consumable is stacked onto its entry if there is one, else it goes in a
// new slot at the end. Throws if it doesn't fit (check canAddItem first) or quantity
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
