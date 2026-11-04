// Pure rules for equipment, Tactics Ogre style: a unit wears its gear in
// slots apart from its bag. A humanoid has a main hand (a weapon or a
// staff), an off hand (a shield, while the main hand holds a one-handed
// weapon or nothing), a head, a body and one accessory; a monster (a unit
// that fights with its body: beasts, rams, elementals and the monster
// classes) has a special slot, which takes only signature gear made for its
// class, and an accessory. The bag holds consumables (items.ts), and the
// weapons a body comes with (fists, a monster's natural weapon, spells it
// knows) are its innate attacks, never gear. Gear never breaks and is set
// between battles, never swapped mid-battle. No Phaser, no hidden state.

import type { Curse } from './curses.ts';
import type { Staff } from './healing.ts';
import type { Modifier } from './modifiers.ts';
import { MAX_INVENTORY_SLOTS, type Armor, type Inventory, type InventoryEntry, type Item } from './items.ts';
import { NATURAL_WEAPON_IDS, type Weapon } from './weapons.ts';

export type GearSlot = 'main' | 'off' | 'head' | 'body' | 'accessory' | 'special';

// Which slots a unit has: a humanoid's paper doll or a monster's.
export type GearLayout = 'humanoid' | 'monster';

export const GEAR_SLOTS: Readonly<Record<GearLayout, readonly GearSlot[]>> = Object.freeze({
  humanoid: Object.freeze<GearSlot[]>(['main', 'off', 'head', 'body', 'accessory']),
  monster: Object.freeze<GearSlot[]>(['special', 'accessory']),
});

export const GEAR_SLOT_LABELS: Readonly<Record<GearSlot, string>> = Object.freeze({
  main: 'Main hand',
  off: 'Off hand',
  head: 'Head',
  body: 'Body',
  accessory: 'Accessory',
  special: 'Special',
});

// What can be worn: a weapon (not a natural one), a staff or armor.
export type Gear = Weapon | Staff | Armor;

// What a unit wears, by slot; an empty slot is left out.
export type Equipment = Readonly<Partial<Record<GearSlot, Gear>>>;

export const NO_EQUIPMENT: Equipment = Object.freeze({});

// The classes that fight with their bodies and wear the monster layout.
const MONSTER_LAYOUT_CLASSES: ReadonlySet<string> = new Set([
  'beast',
  'whelp',
  'ram',
  'bat',
  'dragon',
  'goblin',
  'minotaur',
  'orc',
  'skeleton',
  'slime',
  'troll',
]);

// The layout a unit of class `unitClass` wears.
export function getGearLayout(unitClass: string | null): GearLayout {
  if (unitClass && (MONSTER_LAYOUT_CLASSES.has(unitClass) || unitClass.endsWith('-elemental'))) return 'monster';
  return 'humanoid';
}

// Whether an item is gear: anything worn in a slot. Natural weapons belong
// to a body and consumables and seals go in the bag or the convoy.
export function isGear(item: Item): item is Gear {
  if (item.kind === 'weapon') return !NATURAL_WEAPON_IDS.has(item.id);
  return item.kind === 'staff' || item.kind === 'armor';
}

// The slot a piece of gear goes in.
export function getGearSlot(gear: Gear): GearSlot {
  if (gear.kind !== 'armor') return 'main';
  return gear.slot === 'shield' ? 'off' : gear.slot;
}

// The weapon in the main hand, or null (empty, or a staff).
export function getMainWeapon(equipment: Equipment): Weapon | null {
  const main = equipment.main;
  return main?.kind === 'weapon' ? main : null;
}

// The staff in the main hand, or null.
export function getMainStaff(equipment: Equipment): Staff | null {
  const main = equipment.main;
  return main?.kind === 'staff' ? main : null;
}

// Whether the off hand is free for a shield: the main hand is empty or holds
// a one-handed weapon (every staff takes both hands).
export function hasHandFree(equipment: Equipment): boolean {
  const main = equipment.main;
  return !main || main.kind === 'armor' || main.hands === 1;
}

// Whether `gear` can be worn by a unit with `layout`, of class `unitClass`:
// its slot is one the layout has, special gear is made for the unit's
// class, and a shield has a hand free for it in `equipment`.
export function canEquip(equipment: Equipment, gear: Gear, layout: GearLayout, unitClass: string | null): boolean {
  const slot = getGearSlot(gear);
  if (!GEAR_SLOTS[layout].includes(slot)) return false;
  if (slot === 'special' && (gear.kind !== 'armor' || gear.forClass !== unitClass)) return false;
  if (slot === 'off' && !hasHandFree(equipment)) return false;
  return true;
}

// Wears `gear` in its slot. Returns the new equipment and the gear it
// displaced: whatever was in that slot, and the shield when a two-handed
// weapon or a staff goes in the main hand. Throws if it can't be worn.
export function equipGear(
  equipment: Equipment,
  gear: Gear,
  layout: GearLayout,
  unitClass: string | null,
): { equipment: Equipment; removed: readonly Gear[] } {
  if (!canEquip(equipment, gear, layout, unitClass)) throw new Error(`Can't equip ${gear.id}`);
  const slot = getGearSlot(gear);
  const removed: Gear[] = [];
  const next: Partial<Record<GearSlot, Gear>> = { ...equipment, [slot]: gear };
  const old = equipment[slot];
  if (old) removed.push(old);
  if (gear.kind !== 'armor' && gear.hands === 2 && next.off) {
    removed.push(next.off);
    delete next.off;
  }
  return { equipment: Object.freeze(next), removed: Object.freeze(removed) };
}

// Empties `slot`. Returns the new equipment and what was in it (or null).
export function unequipGear(equipment: Equipment, slot: GearSlot): { equipment: Equipment; removed: Gear | null } {
  const removed = equipment[slot] ?? null;
  if (!removed) return { equipment, removed };
  const { [slot]: _gone, ...rest } = equipment;
  return { equipment: Object.freeze(rest), removed };
}

// Every slot, in the order they're listed.
export const GEAR_SLOT_ORDER: readonly GearSlot[] = Object.freeze([
  'main',
  'off',
  'head',
  'body',
  'accessory',
  'special',
]);

// Every piece of worn gear, in slot order.
export function getWornGear(equipment: Equipment): Gear[] {
  return GEAR_SLOT_ORDER.map((slot) => equipment[slot]).filter((gear): gear is Gear => gear !== undefined);
}

// What the worn gear adds (its `modifiers`) and costs (its `curses`), in
// slot order. Unit.modifiers and Unit.curses include them.
export function getGearModifiers(equipment: Equipment): Modifier[] {
  return getWornGear(equipment).flatMap((gear) => gear.modifiers ?? []);
}

export function getGearCurses(equipment: Equipment): Curse[] {
  return getWornGear(equipment).flatMap((gear) => gear.curses ?? []);
}

// The armor worn (every slot but the main hand), in slot order.
export function getWornArmor(equipment: Equipment): Armor[] {
  return getWornGear(equipment).filter((gear): gear is Armor => gear.kind === 'armor');
}

// What the worn armor adds to defense against physical hits.
export function getArmorDefense(equipment: Equipment): number {
  return getWornArmor(equipment).reduce((total, armor) => total + armor.defense, 0);
}

// What the worn armor adds to avoid (light armor).
export function getArmorAvoid(equipment: Equipment): number {
  return getWornArmor(equipment).reduce((total, armor) => total + (armor.avoid ?? 0), 0);
}

// What the worn armor adds to resistance against magical hits (cloth).
export function getArmorResistance(equipment: Equipment): number {
  return getWornArmor(equipment).reduce((total, armor) => total + (armor.resistance ?? 0), 0);
}

// What the worn armor weighs. It slows the unit along with its weapon.
export function getArmorWeight(equipment: Equipment): number {
  return getWornArmor(equipment).reduce((total, armor) => total + armor.weight, 0);
}

// A unit's kit sorted into its parts.
export interface Loadout {
  equipment: Equipment;
  // Weapons its body comes with: fists, natural weapons, spells.
  innate: readonly Weapon[];
  // Consumables, at most MAX_INVENTORY_SLOTS entries.
  bag: Inventory;
  // What didn't fit: gear for a filled slot or one the layout lacks,
  // seals, and consumables past a full bag.
  spare: readonly InventoryEntry[];
}

// Sorts a mixed list of items, as a class kit or an old save lists them,
// into equipment, innate attacks and the bag: each natural weapon is innate
// (once), each piece of gear fills its slot if that's still empty and it
// can be worn (in list order, so the first weapon is the one equipped), and
// each consumable goes in the bag while there's room.
export function createLoadout(entries: Inventory, layout: GearLayout, unitClass: string | null): Loadout {
  let equipment: Equipment = NO_EQUIPMENT;
  const innate: Weapon[] = [];
  const bag: InventoryEntry[] = [];
  const spare: InventoryEntry[] = [];
  for (const entry of entries) {
    if (entry.quantity <= 0) continue;
    const { item } = entry;
    if (item.kind === 'weapon' && NATURAL_WEAPON_IDS.has(item.id)) {
      if (!innate.some((weapon) => weapon.id === item.id)) innate.push(item);
    } else if (isGear(item)) {
      if (!equipment[getGearSlot(item)] && canEquip(equipment, item, layout, unitClass)) {
        equipment = equipGear(equipment, item, layout, unitClass).equipment;
      } else {
        spare.push(entry);
      }
    } else if (item.kind === 'consumable' && bag.length < MAX_INVENTORY_SLOTS) {
      bag.push(Object.freeze({ item, quantity: entry.quantity }));
    } else {
      spare.push(entry);
    }
  }
  return Object.freeze({
    equipment,
    innate: Object.freeze(innate),
    bag: Object.freeze(bag),
    spare: Object.freeze(spare),
  });
}
