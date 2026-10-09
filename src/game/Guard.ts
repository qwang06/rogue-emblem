import { STARTING_ITEMS, type Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { IRON_SPEAR, weaponEntry, type WeaponType } from './weapons.ts';

// Armored and slow: a soldier's strength and skill behind a tower shield,
// with far more defense, but less speed and one less tile of movement.
export const GUARD_STATS = Object.freeze({
  health: 12,
  mana: 5,
  strength: 4,
  magic: 0,
  skill: 3,
  speed: 1,
  luck: 1,
  defense: 5,
  resistance: 0,
  movement: 4,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const GUARD_GROWTHS = Object.freeze({
  health: 75,
  mana: 25,
  strength: 45,
  magic: 0,
  skill: 35,
  speed: 20,
  luck: 25,
  defense: 50,
  resistance: 10,
});

// The most each stat can reach through level ups.
export const GUARD_CAPS = Object.freeze({
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

// The weapon types a guard can wield.
export const GUARD_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a guard carries into battle: a spear and the potions.
export const GUARD_ITEMS: Inventory = Object.freeze([weaponEntry(IRON_SPEAR), ...STARTING_ITEMS]);

// The armored spear-and-tower-shield infantry. Starts at level 1 with the
// guard stat line; its skills come from the 'guard' skill tree, it wields
// physical weapons, and it carries an Iron Spear and the potions unless
// given other items. Levels up with the guard growth rates and caps.
export class Guard extends Unit {
  constructor({ name = 'Guard', team, level = 1, items = GUARD_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'guard',
      level,
      team,
      items,
      weaponTypes: GUARD_WEAPON_TYPES,
      growths: GUARD_GROWTHS,
      caps: GUARD_CAPS,
      ...GUARD_STATS,
    });
  }
}
