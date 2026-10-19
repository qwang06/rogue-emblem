import type { Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { GREAT_AXE, weaponEntry, type WeaponType } from './weapons.ts';

// The heavy monster: slow, but tough enough to take several hits and
// hits harder than any other monster with its Great Axe.
export const ORC_STATS = Object.freeze({
  health: 14,
  mana: 0,
  strength: 5,
  magic: 0,
  skill: 2,
  speed: 2,
  luck: 1,
  defense: 2,
  resistance: 0,
  movement: 4,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const ORC_GROWTHS = Object.freeze({
  health: 80,
  mana: 0,
  strength: 55,
  magic: 0,
  skill: 30,
  speed: 20,
  luck: 15,
  defense: 35,
  resistance: 10,
});

// The most each stat can reach through level ups.
export const ORC_CAPS = Object.freeze({
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

// The weapon types an orc can wield.
export const ORC_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What an orc carries into battle: only its Great Axe, which never breaks.
// Monsters carry no potions.
export const ORC_ITEMS: Inventory = Object.freeze([weaponEntry(GREAT_AXE)]);

// A monster, met as an enemy in Warband Mode. Starts at level 1 with the
// orc stat line and no mana; it has no skill tree, wields physical
// weapons, and fights with its Great Axe unless given other items.
export class Orc extends Unit {
  constructor({ name = 'Orc', team, level = 1, items = ORC_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'orc',
      level,
      team,
      items,
      weaponTypes: ORC_WEAPON_TYPES,
      growths: ORC_GROWTHS,
      caps: ORC_CAPS,
      ...ORC_STATS,
    });
  }
}
