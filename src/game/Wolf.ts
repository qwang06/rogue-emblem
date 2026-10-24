import type { Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { BITE, weaponEntry, type WeaponType } from './weapons.ts';

// A fast hunter: covers the most ground of any monster and bites hard,
// but its hide stops little.
export const WOLF_STATS = Object.freeze({
  health: 9,
  mana: 0,
  strength: 4,
  magic: 0,
  skill: 4,
  speed: 5,
  luck: 2,
  defense: 1,
  resistance: 0,
  movement: 6,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const WOLF_GROWTHS = Object.freeze({
  health: 60,
  mana: 0,
  strength: 45,
  magic: 0,
  skill: 40,
  speed: 50,
  luck: 25,
  defense: 20,
  resistance: 10,
});

// The most each stat can reach through level ups.
export const WOLF_CAPS = Object.freeze({
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

// The weapon types a wolf can wield.
export const WOLF_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a wolf carries into battle: only its Bite, which never breaks.
// Monsters carry no potions.
export const WOLF_ITEMS: Inventory = Object.freeze([weaponEntry(BITE)]);

// A monster, met as an enemy in Warband Mode. Starts at level 1 with the
// wolf stat line and no mana; it has no skill tree, wields physical
// weapons, and fights with its Bite unless given other items.
export class Wolf extends Unit {
  override monster = true;

  constructor({ name = 'Wolf', team, level = 1, items = WOLF_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'wolf',
      level,
      team,
      items,
      weaponTypes: WOLF_WEAPON_TYPES,
      growths: WOLF_GROWTHS,
      caps: WOLF_CAPS,
      ...WOLF_STATS,
    });
  }
}
