import type { Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { BONE_CLAWS, weaponEntry, type WeaponType } from './weapons.ts';

// The sturdy monster: slow and unlucky, but its bones shrug off weak hits
// and its claws hit harder than a spear.
export const SKELETON_STATS = Object.freeze({
  health: 10,
  mana: 0,
  strength: 4,
  magic: 0,
  skill: 3,
  speed: 2,
  luck: 0,
  defense: 3,
  resistance: 0,
  movement: 4,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const SKELETON_GROWTHS = Object.freeze({
  health: 70,
  mana: 0,
  strength: 45,
  magic: 0,
  skill: 35,
  speed: 25,
  luck: 5,
  defense: 40,
  resistance: 10,
});

// The most each stat can reach through level ups.
export const SKELETON_CAPS = Object.freeze({
  health: 40,
  mana: 0,
  strength: 20,
  magic: 20,
  skill: 20,
  speed: 20,
  luck: 20,
  defense: 20,
  resistance: 20,
});

// The weapon types a skeleton can wield.
export const SKELETON_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a skeleton carries into battle: only its Bone Claws, which never breaks.
// Monsters carry no potions.
export const SKELETON_ITEMS: Inventory = Object.freeze([weaponEntry(BONE_CLAWS)]);

// A monster, met as an enemy in Warband Mode. Starts at level 1 with the
// skeleton stat line and no mana; it has no skill tree, wields physical
// weapons, and fights with its Bone Claws unless given other items.
export class Skeleton extends Unit {
  constructor({ name = 'Skeleton', team, level = 1, items = SKELETON_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'skeleton',
      level,
      team,
      items,
      weaponTypes: SKELETON_WEAPON_TYPES,
      growths: SKELETON_GROWTHS,
      caps: SKELETON_CAPS,
      ...SKELETON_STATS,
    });
  }
}
