import { STARTING_ITEMS, type Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { FISTS, weaponEntry, WOODEN_SWORD, type WeaponType } from './weapons.ts';

// The starting unit: a townsperson with a wooden sword and no armor, the
// first tier of the class tree. A villager starts a point of strength
// below a soldier, so early on it's the weakest unit; it makes up for that
// with the highest growth total of any class and earns XP half
// again as fast (VILLAGER_EXPERIENCE_RATE), and at PROMOTION_LEVEL it
// becomes an Archer, Soldier, Vanguard or Sapper (promotions.ts).
export const VILLAGER_STATS = Object.freeze({
  health: 10,
  mana: 5,
  strength: 3,
  intelligence: 0,
  skill: 3,
  speed: 3,
  luck: 2,
  defense: 2,
  resistance: 0,
  movement: 5,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const VILLAGER_GROWTHS = Object.freeze({
  health: 85,
  mana: 45,
  strength: 60,
  intelligence: 10,
  skill: 55,
  speed: 55,
  luck: 50,
  defense: 45,
  resistance: 25,
});

// Percent of each XP gain a villager earns (see scaleExperience).
export const VILLAGER_EXPERIENCE_RATE = 150;

// The weapon types a villager can wield.
export const VILLAGER_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a villager carries into battle: a wooden sword, its fists (which
// never break) for when the sword does, and the potions.
export const VILLAGER_ITEMS: Inventory = Object.freeze([
  weaponEntry(WOODEN_SWORD),
  weaponEntry(FISTS),
  ...STARTING_ITEMS,
]);

// The starting unit. Starts at level 1 with the villager stat line; its
// skills come from the 'villager' skill tree, it wields physical weapons,
// and it fights with a wooden sword (then its fists) and carries the
// potions unless given other items. Levels up with the villager growth
// rates, and earns XP at the villager rate.
export class Villager extends Unit {
  constructor({ name = 'Villager', team, level = 1, items = VILLAGER_ITEMS, faction }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'villager',
      level,
      team,
      faction,
      items,
      weaponTypes: VILLAGER_WEAPON_TYPES,
      growths: VILLAGER_GROWTHS,
      experienceRate: VILLAGER_EXPERIENCE_RATE,
      ...VILLAGER_STATS,
    });
  }
}
