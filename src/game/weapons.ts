// Pure rules for weapons. A weapon is an item a unit carries in its
// inventory (see items.ts) and fights with: it sets the unit's attack
// range, the kind of damage it deals, and adds its might, hit and crit to
// the combat formulas (combat.ts, combatStats.ts). Each class masters some
// weapon types and can only wield those. The equipped weapon is the first
// one in the inventory the unit can wield; equipping another moves it to
// the front. A weapon entry's `quantity` is the uses it has left, one
// spent per strike, and a weapon that runs out breaks and is gone —
// unless its `uses` is null, which never breaks. No Phaser, no rendering,
// no hidden state.

import type { MenuAction } from './actionMenu.ts';
import type { DamageType } from './combat.ts';
import type { Inventory, InventoryEntry } from './items.ts';

// What a class can master. Physical and siege weapons hit with strength
// against defense, magical ones with magic against resistance; siege
// weapons are the long-range engines and bombs only siege units wield.
export type WeaponType = 'physical' | 'magical' | 'siege';

// A weapon: { kind: 'weapon', id, label, type, might, hit, crit, weight,
// minRange, maxRange, uses }. `might` adds to the wielder's attack power,
// `hit` and `crit` to its hit and crit rates, `weight` slows a wielder
// weaker than it (see getAttackSpeed in combatStats.ts). `uses` is how
// many strikes a fresh one has, or null for one that never breaks.
export interface Weapon {
  kind: 'weapon';
  id: string;
  label: string;
  type: WeaponType;
  might: number;
  hit: number;
  crit: number;
  weight: number;
  minRange: number;
  maxRange: number;
  uses: number | null;
}

// The equipped weapon and where it sits in the inventory.
export interface EquippedWeapon {
  weapon: Weapon;
  index: number;
  uses: number | null;
}

export interface WeaponAction extends MenuAction {
  index: number;
  type: WeaponType;
  uses: number | null;
  might: number;
  hit: number;
  crit: number;
  weight: number;
  range: string;
}

export const WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical', 'magical', 'siege']);

// The kind of damage each weapon type deals.
export const WEAPON_DAMAGE_TYPES: Readonly<Record<WeaponType, DamageType>> = Object.freeze({
  physical: 'physical',
  magical: 'magical',
  siege: 'physical',
});

function weapon(fields: Omit<Weapon, 'kind'>): Weapon {
  return Object.freeze({ kind: 'weapon', ...fields });
}

// The starter weapons, one per armed unit in the unit catalog (see the
// tileset skill's units-catalog.md). Numbers are scaled to the game's small
// stat lines (10 HP, 4 STR at level 1).

// Bare hands: what villagers fight with. Never breaks.
export const FISTS = weapon({
  id: 'fists',
  label: 'Fists',
  type: 'physical',
  might: 0,
  hit: 80,
  crit: 0,
  weight: 0,
  minRange: 1,
  maxRange: 1,
  uses: null,
});

// The soldier's spear.
export const IRON_SPEAR = weapon({
  id: 'iron-spear',
  label: 'Iron Spear',
  type: 'physical',
  might: 1,
  hit: 80,
  crit: 0,
  weight: 3,
  minRange: 1,
  maxRange: 1,
  uses: 40,
});

// The vanguard's axe: hits hard, misses more, and is heavy.
export const IRON_AXE = weapon({
  id: 'iron-axe',
  label: 'Iron Axe',
  type: 'physical',
  might: 3,
  hit: 65,
  crit: 0,
  weight: 5,
  minRange: 1,
  maxRange: 1,
  uses: 40,
});

// The archer's bow: two tiles away only, so it can't strike adjacent foes.
export const IRON_BOW = weapon({
  id: 'iron-bow',
  label: 'Iron Bow',
  type: 'physical',
  might: 2,
  hit: 80,
  crit: 0,
  weight: 2,
  minRange: 2,
  maxRange: 2,
  uses: 40,
});

// The elementals' and wizards' spell: magic against resistance, near or
// one tile further.
export const FIRE = weapon({
  id: 'fire',
  label: 'Fire',
  type: 'magical',
  might: 2,
  hit: 85,
  crit: 0,
  weight: 1,
  minRange: 1,
  maxRange: 2,
  uses: 30,
});

// The sapper's bomb: a heavy blast, near or thrown, with few to spare.
export const POWDER_KEG = weapon({
  id: 'powder-keg',
  label: 'Powder Keg',
  type: 'siege',
  might: 5,
  hit: 70,
  crit: 0,
  weight: 6,
  minRange: 1,
  maxRange: 2,
  uses: 5,
});

// The siege engine's bolt thrower: long range, nothing up close.
export const BALLISTA = weapon({
  id: 'ballista',
  label: 'Ballista',
  type: 'siege',
  might: 6,
  hit: 70,
  crit: 0,
  weight: 8,
  minRange: 2,
  maxRange: 3,
  uses: 10,
});

// The monsters' natural weapons, which never break. The slime's body slam:
// no might at all.
export const TACKLE = weapon({
  id: 'tackle',
  label: 'Tackle',
  type: 'physical',
  might: 0,
  hit: 75,
  crit: 0,
  weight: 0,
  minRange: 1,
  maxRange: 1,
  uses: null,
});

// The goblin's club.
export const CLUB = weapon({
  id: 'club',
  label: 'Club',
  type: 'physical',
  might: 2,
  hit: 75,
  crit: 0,
  weight: 2,
  minRange: 1,
  maxRange: 1,
  uses: null,
});

// The skeleton's claws.
export const BONE_CLAWS = weapon({
  id: 'bone-claws',
  label: 'Bone Claws',
  type: 'physical',
  might: 2,
  hit: 80,
  crit: 0,
  weight: 1,
  minRange: 1,
  maxRange: 1,
  uses: null,
});

export const WEAPONS: readonly Weapon[] = Object.freeze([
  FISTS,
  IRON_SPEAR,
  IRON_AXE,
  IRON_BOW,
  FIRE,
  POWDER_KEG,
  BALLISTA,
  TACKLE,
  CLUB,
  BONE_CLAWS,
]);

// A fresh inventory entry for weapon, with all its uses (1 for one that
// never breaks — its count is never spent).
export function weaponEntry(weapon: Weapon): InventoryEntry {
  return Object.freeze({ item: weapon, quantity: weapon.uses ?? 1 });
}

export function isWeapon(item: { kind: string }): item is Weapon {
  return item.kind === 'weapon';
}

// Whether a unit that masters `weaponTypes` can wield weapon.
export function canWield(weaponTypes: readonly WeaponType[], weapon: Weapon): boolean {
  return weaponTypes.includes(weapon.type);
}

// The uses an entry's weapon has left: its quantity, or null if it never
// breaks.
function usesLeft(entry: InventoryEntry & { item: Weapon }): number | null {
  return entry.item.uses === null ? null : entry.quantity;
}

// Every weapon in the inventory the unit can wield, in inventory order, as
// [{ weapon, index, uses }]. The first is the equipped one.
export function getWieldableWeapons(inventory: Inventory, weaponTypes: readonly WeaponType[]): EquippedWeapon[] {
  const result: EquippedWeapon[] = [];
  inventory.forEach((entry, index) => {
    const { item } = entry;
    if (isWeapon(item) && canWield(weaponTypes, item)) {
      result.push({ weapon: item, index, uses: usesLeft({ ...entry, item }) });
    }
  });
  return result;
}

// The weapon the unit fights with: the first one in its inventory it can
// wield, as { weapon, index, uses }, or null if it has none.
export function getEquippedWeapon(inventory: Inventory, weaponTypes: readonly WeaponType[]): EquippedWeapon | null {
  return getWieldableWeapons(inventory, weaponTypes)[0] ?? null;
}

// Equips the weapon at `index` by moving its entry to the front of the
// inventory; everything else keeps its order. Throws if there's no weapon
// the unit can wield there.
export function equipWeapon(inventory: Inventory, index: number, weaponTypes: readonly WeaponType[]): Inventory {
  const entry = inventory[index];
  if (!entry || !isWeapon(entry.item) || !canWield(weaponTypes, entry.item)) {
    throw new Error(`No weapon to equip at slot ${index}`);
  }
  if (index === 0) return inventory;
  return Object.freeze([entry, ...inventory.filter((_, i) => i !== index)]);
}

// Spends one use of the weapon at `index` and returns { inventory, broke }:
// a weapon that runs out is removed (broke is true), and one that never
// breaks is left as it was. Throws if there's no weapon there.
export function spendWeaponUse(inventory: Inventory, index: number): { inventory: Inventory; broke: boolean } {
  const entry = inventory[index];
  if (!entry || !isWeapon(entry.item)) throw new Error(`No weapon at slot ${index}`);
  if (entry.item.uses === null) return { inventory, broke: false };
  const quantity = entry.quantity - 1;
  if (quantity > 0) {
    const next = inventory.map((e, i) => (i === index ? Object.freeze({ ...e, quantity }) : e));
    return { inventory: Object.freeze(next), broke: false };
  }
  return { inventory: Object.freeze(inventory.filter((_, i) => i !== index)), broke: true };
}

// The span of tiles any of `weapons` can strike, as { minRange, maxRange }
// — the shortest minimum and the longest maximum — or null for none. Used
// for the threat fringe around a unit's move range.
export function getWeaponReach(weapons: readonly Weapon[]): { minRange: number; maxRange: number } | null {
  if (weapons.length === 0) return null;
  return {
    minRange: Math.min(...weapons.map((w) => w.minRange)),
    maxRange: Math.max(...weapons.map((w) => w.maxRange)),
  };
}

// A weapon's range as it reads in the UI: "1", or "1–2" for a span.
export function formatWeaponRange(weapon: Pick<Weapon, 'minRange' | 'maxRange'>): string {
  return weapon.minRange === weapon.maxRange ? `${weapon.minRange}` : `${weapon.minRange}–${weapon.maxRange}`;
}

// Entries for the weapon menu shown after choosing Attack: every weapon
// the unit can wield (equipped first), with its uses left (null for one
// that never breaks) and its numbers. One is disabled when hasTarget(weapon)
// says nothing is in its range from where the unit stands.
export function getWeaponActions(
  inventory: Inventory,
  weaponTypes: readonly WeaponType[],
  hasTarget: (weapon: Weapon) => boolean,
): readonly WeaponAction[] {
  return Object.freeze(
    getWieldableWeapons(inventory, weaponTypes).map(({ weapon, index, uses }) =>
      Object.freeze({
        id: `${weapon.id}@${index}`,
        label: weapon.label,
        index,
        type: weapon.type,
        uses,
        might: weapon.might,
        hit: weapon.hit,
        crit: weapon.crit,
        weight: weapon.weight,
        range: formatWeaponRange(weapon),
        disabled: !hasTarget(weapon),
      }),
    ),
  );
}
