import { STARTING_ITEMS, type Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { IRON_SPEAR, weaponEntry, type WeaponType } from './weapons.ts';

export const SOLDIER_STATS = Object.freeze({
  health: 10,
  mana: 5,
  strength: 4,
  magic: 0,
  skill: 3,
  speed: 3,
  luck: 2,
  defense: 2,
  resistance: 0,
  movement: 5,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const SOLDIER_GROWTHS = Object.freeze({
  health: 70,
  mana: 40,
  strength: 45,
  magic: 5,
  skill: 40,
  speed: 40,
  luck: 30,
  defense: 30,
  resistance: 15,
});

// The most each stat can reach through level ups.
export const SOLDIER_CAPS = Object.freeze({
  health: 40,
  mana: 30,
  strength: 20,
  magic: 20,
  skill: 20,
  speed: 20,
  luck: 20,
  defense: 20,
  resistance: 20,
});

// The weapon types a soldier can wield.
export const SOLDIER_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a soldier carries into battle: its spear and the potions.
export const SOLDIER_ITEMS: Inventory = Object.freeze([weaponEntry(IRON_SPEAR), ...STARTING_ITEMS]);

// The basic spear-and-shield infantry. Starts at level 1 with the soldier
// stat line; its skills come from the 'soldier' skill tree, it wields
// physical weapons, and it carries an Iron Spear and the potions unless
// given other items. Levels up with the soldier growth rates and caps.
export class Soldier extends Unit {
  constructor({ name = 'Soldier', team, level = 1, items = SOLDIER_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'soldier',
      level,
      team,
      items,
      weaponTypes: SOLDIER_WEAPON_TYPES,
      growths: SOLDIER_GROWTHS,
      caps: SOLDIER_CAPS,
      ...SOLDIER_STATS,
    });
  }
}
