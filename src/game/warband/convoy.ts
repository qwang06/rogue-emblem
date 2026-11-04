// Warband Mode's convoy: the items a run holds for the whole warband rather
// than for one unit (RunState.convoy), and the armory its units' gear
// comes from. Between stages the roster and equipment screens move items
// between it and the units: a consumable goes into a unit's bag (one at a
// time, stacking on both sides) and back; gear is worn straight from the
// convoy into its slot (equipment.ts), and whatever it displaces, or a
// slot taken off, goes back to the convoy. The convoy has no slot limit; a
// bag holds at most MAX_INVENTORY_SLOTS entries. A natural weapon (fists,
// claws, a known spell) belongs to its body and never moves. Everything
// here is pure: each function returns a new frozen run and leaves its
// input alone.

import {
  canEquip,
  equipGear,
  getGearLayout,
  isGear,
  unequipGear,
  type Equipment,
  type GearSlot,
} from '../equipment.ts';
import { MAX_INVENTORY_SLOTS, type Item } from '../items.ts';
import { isCursed } from '../gearKits.ts';
import { UNIT_CLASSES, type UnitClass } from '../unitClasses.ts';
import { isWeapon, NATURAL_WEAPON_IDS } from '../weapons.ts';
import {
  getSnapshotLoadout,
  restoreUnit,
  RUN_ITEMS,
  snapshotEquipment,
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

// Whether an item stacks: only consumables do, as in a unit's bag.
export function isStackable(item: Item): boolean {
  return item.kind === 'consumable';
}

// Whether an item can leave the unit carrying it: anything but a natural
// weapon.
export function isMovable(item: Item): boolean {
  return !NATURAL_WEAPON_IDS.has(item.id);
}

// Whether the unit `unitId` can take the convoy entry at `convoyIndex`
// (see canCarry).
export function canGiveFromConvoy(
  run: RunState,
  unitId: string,
  convoyIndex: number,
  items: readonly Item[] = RUN_ITEMS,
): boolean {
  const entry = run.convoy[convoyIndex];
  return entry !== undefined && canCarry(run, unitId, entry.itemId, items);
}

// Whether the unit `unitId` can take one more `itemId`: a consumable into
// its bag (stacking, or a free slot), or gear it can wear (a slot its
// layout has, a shield with a hand free; whatever's in the slot goes back
// to the convoy). Seals stay in the convoy.
export function canCarry(run: RunState, unitId: string, itemId: string, items: readonly Item[] = RUN_ITEMS): boolean {
  const unit = findUnit(run, unitId);
  if (!unit) return false;
  const item = lookUpItem(itemId, items);
  if (isStackable(item)) {
    return unit.items.some((held) => held.itemId === item.id) || unit.items.length < MAX_INVENTORY_SLOTS;
  }
  if (!isGear(item)) return false;
  const equipment = getUnitEquipment(unit, items);
  if (!canEquip(equipment, item, getGearLayout(unit.classId), unit.classId)) return false;
  // Cursed gear sticks: nothing displaces it (see unequipToConvoy).
  const { removed } = equipGear(equipment, item, getGearLayout(unit.classId), unit.classId);
  return !removed.some(isCursed);
}

// What taking cursed gear off costs at camp, in gold. Cursed gear sticks
// to its wearer: it can't be swapped out, only taken off for this.
export const CLEANSE_COST = 40;

// What taking off the unit `unitId`'s gear in `slot` costs: CLEANSE_COST
// for cursed gear, else nothing.
export function getUnequipCost(
  run: RunState,
  unitId: string,
  slot: GearSlot,
  items: readonly Item[] = RUN_ITEMS,
): number {
  const unit = findUnit(run, unitId);
  const gear = unit ? getUnitEquipment(unit, items)[slot] : undefined;
  return gear && isCursed(gear) ? CLEANSE_COST : 0;
}

// The gear the unit wears, by slot.
export function getUnitEquipment(unit: UnitSnapshot, items: readonly Item[] = RUN_ITEMS): Equipment {
  return getSnapshotLoadout(unit, items).equipment;
}

// Whether `itemId` is gear for the unit `unitId`, so it's one to hand a new
// one to: a weapon its class is trained in that strikes at the same range
// as its main-hand weapon (a bow for an archer, not a spear), or any it's
// trained in when its main hand holds no weapon; a staff when it already
// heals with one; or armor for an empty slot it can wear it in.
// Consumables suit nobody in particular.
export function isSuitedTo(
  run: RunState,
  unitId: string,
  itemId: string,
  classes: readonly UnitClass[] = UNIT_CLASSES,
  items: readonly Item[] = RUN_ITEMS,
): boolean {
  const unit = findUnit(run, unitId);
  if (!unit) return false;
  const item = lookUpItem(itemId, items);
  if (!isGear(item)) return false;
  const equipment = getUnitEquipment(unit, items);
  if (!canEquip(equipment, item, getGearLayout(unit.classId), unit.classId)) return false;
  const main = equipment.main;
  if (isWeapon(item)) {
    if (!restoreUnit(unit, classes, items).weaponTypes.includes(item.type)) return false;
    if (main?.kind === 'staff') return false;
    if (!main || !isWeapon(main)) return true;
    return main.minRange === item.minRange && main.maxRange === item.maxRange;
  }
  if (item.kind === 'staff') return main?.kind === 'staff';
  return item.slot === 'shield' ? !equipment.off : !equipment[item.slot === 'special' ? 'special' : item.slot];
}

// The run with the convoy entry at `convoyIndex` given to the unit
// `unitId`: one of a consumable into its bag (stacking onto the one it
// carries), or gear worn in its slot, whatever that displaces going back
// to the convoy. Throws if there's no such unit or entry, or the unit
// can't take it.
export function giveFromConvoy(
  run: RunState,
  unitId: string,
  convoyIndex: number,
  items: readonly Item[] = RUN_ITEMS,
): RunState {
  const unit = requireUnit(run, unitId);
  const entry = run.convoy[convoyIndex];
  if (!entry) throw new Error(`No convoy item at ${convoyIndex}`);
  if (!canGiveFromConvoy(run, unitId, convoyIndex, items)) throw new Error(`${unit.name} can't take ${entry.itemId}`);
  const item = lookUpItem(entry.itemId, items);
  if (isStackable(item)) {
    return freezeRun({
      ...run,
      convoy: takeFrom(run.convoy, convoyIndex, 1),
      roster: replaceUnit(run, { ...unit, items: putInto(unit.items, entry.itemId, 1, true) }),
    });
  }
  const { equipment, removed } = equipGear(
    getUnitEquipment(unit, items),
    item as Exclude<typeof item, { kind: 'consumable' | 'seal' }>,
    getGearLayout(unit.classId),
    unit.classId,
  );
  const convoy = removed.reduce((held, gear) => putInto(held, gear.id, 1, false), takeFrom(run.convoy, convoyIndex, 1));
  return freezeRun({ ...run, convoy, roster: replaceUnit(run, withEquipment(unit, equipment, items)) });
}

// Whether the unit `unitId` has gear in `slot` to take off, and the gold
// for it if it's cursed (getUnequipCost).
export function canUnequip(run: RunState, unitId: string, slot: GearSlot, items: readonly Item[] = RUN_ITEMS): boolean {
  const unit = findUnit(run, unitId);
  if (unit === null || getUnitEquipment(unit, items)[slot] === undefined) return false;
  return run.gold >= getUnequipCost(run, unitId, slot, items);
}

// The run with the unit `unitId`'s gear in `slot` taken off and put in the
// convoy, paying getUnequipCost for cursed gear. Throws if the slot is
// empty or the run can't pay.
export function unequipToConvoy(
  run: RunState,
  unitId: string,
  slot: GearSlot,
  items: readonly Item[] = RUN_ITEMS,
): RunState {
  const unit = requireUnit(run, unitId);
  const cost = getUnequipCost(run, unitId, slot, items);
  const { equipment, removed } = unequipGear(getUnitEquipment(unit, items), slot);
  if (!removed) throw new Error(`${unit.name} wears nothing in ${slot}`);
  if (run.gold < cost) throw new Error(`Cleansing ${removed.label} costs ${cost} gold`);
  return freezeRun({
    ...run,
    gold: run.gold - cost,
    convoy: putInto(run.convoy, removed.id, 1, false),
    roster: replaceUnit(run, withEquipment(unit, equipment, items)),
  });
}

// Whether the unit `unitId`'s bag item at `itemIndex` can be stored: it has
// one there.
export function canStoreInConvoy(
  run: RunState,
  unitId: string,
  itemIndex: number,
  items: readonly Item[] = RUN_ITEMS,
): boolean {
  const entry = findUnit(run, unitId)?.items[itemIndex];
  return entry !== undefined && isMovable(lookUpItem(entry.itemId, items));
}

// The run with one of the unit `unitId`'s bag item at `itemIndex` stored
// in the convoy (stacking onto the convoy's). Throws if there's no such
// unit or item.
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

// `unit` wearing `equipment`, its bag and innate attacks written out in
// the equipment-slot shape (an old snapshot's sorted on the way).
function withEquipment(unit: UnitSnapshot, equipment: Equipment, items: readonly Item[]): UnitSnapshot {
  const loadout = getSnapshotLoadout(unit, items);
  return {
    ...unit,
    items: loadout.bag.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
    equipment: snapshotEquipment(equipment),
    ...(loadout.innate && { innate: loadout.innate.map((weapon) => weapon.id) }),
  };
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
    roster: Object.freeze(
      run.roster.map((unit) =>
        Object.freeze({
          ...unit,
          items: freezeItems(unit.items),
          ...(unit.equipment && { equipment: Object.freeze({ ...unit.equipment }) }),
        }),
      ),
    ),
  });
}
