// Warband Mode's camp merchant: what it sells, what everything costs, and
// buying into and selling out of the convoy (RunState.convoy). Bought
// items arrive in the convoy, fresh, and the roster screen hands them to
// units; selling takes from the convoy, so a unit's item is stored first.
// A consumable is bought and sold one at a time (stacking in the convoy);
// anything else as its whole entry. Selling pays half the price, and for
// a weapon or staff that wears out, only for the uses it has left. A
// natural weapon (fists, claws) belongs to a body and is never sold.
// Everything here is pure: each function returns a new frozen run and
// leaves its input alone.

import { HEALTH_POTION, MANA_POTION, WOODEN_ARMOR, WOODEN_SHIELD, type Item } from '../items.ts';
import { HEAL_STAFF } from '../healing.ts';
import {
  BALLISTA,
  FIRE,
  IRON_AXE,
  IRON_BOW,
  IRON_SPEAR,
  POWDER_KEG,
  WOODEN_AXE,
  WOODEN_SPEAR,
  WOODEN_SWORD,
} from '../weapons.ts';
import { isMovable, isStackable, lookUpItem } from './convoy.ts';
import { RUN_ITEMS, type ItemSnapshot, type RunState } from './run.ts';

// What the merchant sells, by item id: the wooden set.
export const MERCHANT_STOCK: readonly string[] = Object.freeze([
  WOODEN_SWORD.id,
  WOODEN_SPEAR.id,
  WOODEN_AXE.id,
  WOODEN_SHIELD.id,
  WOODEN_ARMOR.id,
]);

// The full price of a fresh item, in gold, by item id. Gold per stage
// cleared is about 15–35 (see rewards.ts), so a wooden weapon is a stage's
// pay.
export const ITEM_PRICES: Readonly<Record<string, number>> = Object.freeze({
  [WOODEN_SWORD.id]: 20,
  [WOODEN_SPEAR.id]: 20,
  [WOODEN_AXE.id]: 25,
  [WOODEN_SHIELD.id]: 15,
  [WOODEN_ARMOR.id]: 25,
  [IRON_SPEAR.id]: 40,
  [IRON_AXE.id]: 45,
  [IRON_BOW.id]: 45,
  [FIRE.id]: 40,
  [POWDER_KEG.id]: 30,
  [BALLISTA.id]: 60,
  [HEAL_STAFF.id]: 40,
  [HEALTH_POTION.id]: 10,
  [MANA_POTION.id]: 10,
});

// The price of an item ITEM_PRICES doesn't list, by kind.
export const DEFAULT_PRICES: Readonly<Record<Item['kind'], number>> = Object.freeze({
  weapon: 30,
  staff: 40,
  armor: 20,
  consumable: 10,
});

// What a fresh `item` costs: its ITEM_PRICES entry, else its kind's
// DEFAULT_PRICES. A natural weapon has no price.
export function getItemPrice(item: Item): number {
  if (!isMovable(item)) return 0;
  return ITEM_PRICES[item.id] ?? DEFAULT_PRICES[item.kind];
}

// What the merchant pays for the convoy entry `entry`: half the price, for
// one of a consumable, or, for a weapon or staff that wears out, in
// proportion to the uses it has left (rounded down). 0 for a natural
// weapon.
export function getSellPrice(entry: ItemSnapshot, items: readonly Item[] = RUN_ITEMS): number {
  const item = lookUpItem(entry.itemId, items);
  const half = getItemPrice(item) / 2;
  const uses = item.kind === 'weapon' || item.kind === 'staff' ? item.uses : null;
  if (uses === null) return Math.floor(half);
  return Math.floor((half * Math.min(entry.quantity, uses)) / uses);
}

// How many of `item` one purchase adds to the convoy: one consumable, or
// a weapon or staff with all its uses, or one piece of armor.
export function getPurchaseQuantity(item: Item): number {
  if (item.kind === 'weapon' || item.kind === 'staff') return item.uses ?? 1;
  return 1;
}

// Whether the warband can buy the stock item `itemId`: the merchant sells
// it and the run has the gold.
export function canBuy(
  run: RunState,
  itemId: string,
  stock: readonly string[] = MERCHANT_STOCK,
  items: readonly Item[] = RUN_ITEMS,
): boolean {
  return stock.includes(itemId) && run.gold >= getItemPrice(lookUpItem(itemId, items));
}

// The run with the stock item `itemId` bought: its price spent and a fresh
// one added to the convoy (a consumable stacking onto the convoy's).
// Throws if the merchant doesn't sell it or the run can't afford it.
export function buyItem(
  run: RunState,
  itemId: string,
  stock: readonly string[] = MERCHANT_STOCK,
  items: readonly Item[] = RUN_ITEMS,
): RunState {
  if (!stock.includes(itemId)) throw new Error(`The merchant doesn't sell ${itemId}`);
  const item = lookUpItem(itemId, items);
  if (!canBuy(run, itemId, stock, items)) throw new Error(`Not enough gold for ${item.label}`);
  const quantity = getPurchaseQuantity(item);
  const stacks = isStackable(item) && run.convoy.some((entry) => entry.itemId === itemId);
  const convoy = stacks
    ? run.convoy.map((entry) => (entry.itemId === itemId ? { ...entry, quantity: entry.quantity + 1 } : entry))
    : [...run.convoy, { itemId, quantity }];
  return freezeRun({ ...run, gold: run.gold - getItemPrice(item), convoy });
}

// Whether the convoy entry at `convoyIndex` can be sold: there's one and
// it isn't a natural weapon.
export function canSell(run: RunState, convoyIndex: number, items: readonly Item[] = RUN_ITEMS): boolean {
  const entry = run.convoy[convoyIndex];
  return entry !== undefined && isMovable(lookUpItem(entry.itemId, items));
}

// The run with the convoy entry at `convoyIndex` sold for getSellPrice:
// one of a consumable, or the whole entry of anything else. Throws if
// there's no such entry or it can't be sold.
export function sellItem(run: RunState, convoyIndex: number, items: readonly Item[] = RUN_ITEMS): RunState {
  const entry = run.convoy[convoyIndex];
  if (!entry) throw new Error(`No convoy item at ${convoyIndex}`);
  if (!canSell(run, convoyIndex, items)) throw new Error(`${entry.itemId} can't be sold`);
  const sold = isStackable(lookUpItem(entry.itemId, items)) ? 1 : entry.quantity;
  const convoy = run.convoy
    .map((held, index) => (index === convoyIndex ? { ...held, quantity: held.quantity - sold } : held))
    .filter((held) => held.quantity > 0);
  return freezeRun({ ...run, gold: run.gold + getSellPrice(entry, items), convoy });
}

function freezeRun(run: RunState): RunState {
  return Object.freeze({ ...run, convoy: Object.freeze(run.convoy.map((entry) => Object.freeze({ ...entry }))) });
}
