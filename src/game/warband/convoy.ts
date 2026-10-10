// Warband Mode's convoy: the items a run holds for the whole warband rather
// than for one unit (RunState.convoy). Between stages the roster screen
// moves items between it and the units: giving a unit an item from the
// convoy, storing a unit's item in it, and equipping a weapon or armor a
// unit carries. Consumables move one at a time and stack, on both sides; every
// other item (a weapon or staff with its uses left, or any gear) moves as
// its whole entry. The convoy has no slot limit; a unit carries at most
// MAX_INVENTORY_SLOTS entries. A natural weapon (fists, claws) belongs to
// its body and never moves. Everything here is pure: each function returns
// a new frozen run and leaves its input alone.

import { getWornArmor, isArmor, MAX_INVENTORY_SLOTS, wearArmor, type Item } from '../items.ts';
import { UNIT_CLASSES, type UnitClass } from '../unitClasses.ts';
import { equipWeapon, getEquippedWeapon, isWeapon, NATURAL_WEAPON_IDS } from '../weapons.ts';
import {
  restoreInventory,
  restoreUnit,
  RUN_ITEMS,
  type ItemSnapshot,
  type RunState,
  type UnitSnapshot,
} from './run.ts';

// The item `itemId` names in `items`. Throws on an unknown id.
export function lookUpItem(itemId: string, items: readonly Item[] = RUN_ITEMS): Item {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`Unknown item: ${itemId}`);
  return item;
}

// Whether an item stacks: only consumables do, as in a unit's inventory.
export function isStackable(item: Item): boolean {
  return item.kind === 'consumable';
}

// Whether an item can leave the unit carrying it: anything but a natural
// weapon.
export function isMovable(item: Item): boolean {
  return !NATURAL_WEAPON_IDS.has(item.id);
}

// Whether the unit `unitId` has room for the convoy entry at `convoyIndex`:
// a consumable it already carries stacks, anything else needs a free slot.
export function canGiveFromConvoy(
  run: RunState,
  unitId: string,
  convoyIndex: number,
  items: readonly Item[] = RUN_ITEMS,
): boolean {
  const unit = findUnit(run, unitId);
  const entry = run.convoy[convoyIndex];
  if (!unit || !entry) return false;
  const item = lookUpItem(entry.itemId, items);
  const stacks = isStackable(item) && unit.items.some((held) => held.itemId === item.id);
  return stacks || unit.items.length < MAX_INVENTORY_SLOTS;
}

// The run with the convoy entry at `convoyIndex` given to the unit
// `unitId`: one of a consumable (stacking onto the one it carries), or
// the whole entry of anything else, added at the end of its inventory.
// Throws if there's no such unit or entry, or the unit has no room.
export function giveFromConvoy(
  run: RunState,
  unitId: string,
  convoyIndex: number,
  items: readonly Item[] = RUN_ITEMS,
): RunState {
  const unit = requireUnit(run, unitId);
  const entry = run.convoy[convoyIndex];
  if (!entry) throw new Error(`No convoy item at ${convoyIndex}`);
  if (!canGiveFromConvoy(run, unitId, convoyIndex, items)) throw new Error(`${unit.name} has no room`);
  const item = lookUpItem(entry.itemId, items);
  const moved = isStackable(item) ? 1 : entry.quantity;
  return freezeRun({
    ...run,
    convoy: takeFrom(run.convoy, convoyIndex, moved),
    roster: replaceUnit(run, { ...unit, items: putInto(unit.items, entry.itemId, moved, isStackable(item)) }),
  });
}

// Whether the unit `unitId`'s item at `itemIndex` can be stored: it has
// one there and it isn't a natural weapon.
export function canStoreInConvoy(
  run: RunState,
  unitId: string,
  itemIndex: number,
  items: readonly Item[] = RUN_ITEMS,
): boolean {
  const entry = findUnit(run, unitId)?.items[itemIndex];
  return entry !== undefined && isMovable(lookUpItem(entry.itemId, items));
}

// The run with the unit `unitId`'s item at `itemIndex` stored in the
// convoy: one of a consumable (stacking onto the convoy's), or the whole
// entry of anything else, added at the end. Throws if there's no such unit
// or item, or it's a natural weapon.
export function storeInConvoy(
  run: RunState,
  unitId: string,
  itemIndex: number,
  items: readonly Item[] = RUN_ITEMS,
): RunState {
  const unit = requireUnit(run, unitId);
  const entry = unit.items[itemIndex];
  if (!entry) throw new Error(`${unit.name} has no item at ${itemIndex}`);
  if (!canStoreInConvoy(run, unitId, itemIndex, items)) throw new Error(`${entry.itemId} can't be stored`);
  const stackable = isStackable(lookUpItem(entry.itemId, items));
  const moved = stackable ? 1 : entry.quantity;
  return freezeRun({
    ...run,
    convoy: putInto(run.convoy, entry.itemId, moved, stackable),
    roster: replaceUnit(run, { ...unit, items: takeFrom(unit.items, itemIndex, moved) }),
  });
}

// The inventory slot of the weapon the unit `unitId` fights with, or null
// if it carries none it can wield.
export function getEquippedIndex(
  run: RunState,
  unitId: string,
  classes: readonly UnitClass[] = UNIT_CLASSES,
  items: readonly Item[] = RUN_ITEMS,
): number | null {
  const unit = findUnit(run, unitId);
  if (!unit) return null;
  return getEquippedWeapon(restoreInventory(unit.items, items), weaponTypesOf(unit, classes, items))?.index ?? null;
}

// The inventory slots of the armor the unit `unitId` wears (the first of
// each slot it carries).
export function getWornIndices(run: RunState, unitId: string, items: readonly Item[] = RUN_ITEMS): number[] {
  const unit = findUnit(run, unitId);
  return unit ? getWornArmor(restoreInventory(unit.items, items)).map(({ index }) => index) : [];
}

// Whether the unit `unitId` can equip its item at `itemIndex`: a weapon
// its class wields that isn't already the equipped one, or armor it isn't
// already wearing (any class wears armor).
export function canEquipInRoster(
  run: RunState,
  unitId: string,
  itemIndex: number,
  classes: readonly UnitClass[] = UNIT_CLASSES,
  items: readonly Item[] = RUN_ITEMS,
): boolean {
  const unit = findUnit(run, unitId);
  const entry = unit?.items[itemIndex];
  if (!unit || !entry) return false;
  const item = lookUpItem(entry.itemId, items);
  if (isArmor(item)) return !getWornIndices(run, unitId, items).includes(itemIndex);
  return (
    isWeapon(item) &&
    weaponTypesOf(unit, classes, items).includes(item.type) &&
    getEquippedIndex(run, unitId, classes, items) !== itemIndex
  );
}

// The run with the unit `unitId`'s weapon or armor at `itemIndex`
// equipped, which moves it to the front of its inventory (see equipWeapon
// and wearArmor). Throws if there's no armor there and no weapon it can
// wield.
export function equipInRoster(
  run: RunState,
  unitId: string,
  itemIndex: number,
  classes: readonly UnitClass[] = UNIT_CLASSES,
  items: readonly Item[] = RUN_ITEMS,
): RunState {
  const unit = requireUnit(run, unitId);
  const carried = restoreInventory(unit.items, items);
  const inventory =
    carried[itemIndex] && isArmor(carried[itemIndex].item)
      ? wearArmor(carried, itemIndex)
      : equipWeapon(carried, itemIndex, weaponTypesOf(unit, classes, items));
  return freezeRun({
    ...run,
    roster: replaceUnit(run, {
      ...unit,
      items: inventory.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
    }),
  });
}

function weaponTypesOf(unit: UnitSnapshot, classes: readonly UnitClass[], items: readonly Item[]) {
  return restoreUnit(unit, classes, items).weaponTypes;
}

function findUnit(run: RunState, unitId: string): UnitSnapshot | null {
  return run.roster.find((unit) => unit.id === unitId) ?? null;
}

function requireUnit(run: RunState, unitId: string): UnitSnapshot {
  const unit = findUnit(run, unitId);
  if (!unit) throw new Error(`No unit ${unitId} on the roster`);
  return unit;
}

function replaceUnit(run: RunState, updated: UnitSnapshot): UnitSnapshot[] {
  return run.roster.map((unit) => (unit.id === updated.id ? updated : unit));
}

// `entries` with `quantity` taken from the entry at `index`, dropping it
// once it's empty.
function takeFrom(entries: readonly ItemSnapshot[], index: number, quantity: number): ItemSnapshot[] {
  return entries
    .map((entry, i) => (i === index ? { ...entry, quantity: entry.quantity - quantity } : entry))
    .filter((entry) => entry.quantity > 0);
}

// `entries` with `quantity` of `itemId` added: stacked onto its entry when
// it stacks and there is one, else as a new entry at the end.
function putInto(entries: readonly ItemSnapshot[], itemId: string, quantity: number, stacks: boolean) {
  if (stacks && entries.some((entry) => entry.itemId === itemId)) {
    return entries.map((entry) =>
      entry.itemId === itemId ? { ...entry, quantity: entry.quantity + quantity } : entry,
    );
  }
  return [...entries, { itemId, quantity }];
}

function freezeItems(items: readonly ItemSnapshot[]): readonly ItemSnapshot[] {
  return Object.freeze(items.map((item) => Object.freeze({ ...item })));
}

function freezeRun(run: RunState): RunState {
  return Object.freeze({
    ...run,
    convoy: freezeItems(run.convoy),
    roster: Object.freeze(run.roster.map((unit) => Object.freeze({ ...unit, items: freezeItems(unit.items) }))),
  });
}
