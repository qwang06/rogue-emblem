import { STARTING_ITEMS, type Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { FISTS, weaponEntry, type WeaponType } from './weapons.ts';

// The late bloomer. A villager starts with a soldier's stat line but only
// its fists, so early on it's the weakest pick; it makes up for that with
// the highest growth total and the highest caps of any class, and earns XP
// half again as fast (VILLAGER_EXPERIENCE_RATE), so a villager that
// survives the early stages outgrows everyone else.
export const VILLAGER_STATS = Object.freeze({
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
export const VILLAGER_GROWTHS = Object.freeze({
  health: 85,
  mana: 45,
  strength: 60,
  magic: 10,
  skill: 55,
  speed: 55,
  luck: 50,
  defense: 45,
  resistance: 25,
});

// The most each stat can reach through level ups.
export const VILLAGER_CAPS = Object.freeze({
  health: 50,
  mana: 35,
  strength: 25,
  magic: 20,
  skill: 25,
  speed: 25,
  luck: 25,
  defense: 25,
  resistance: 25,
});

// Percent of each XP gain a villager earns (see scaleExperience).
export const VILLAGER_EXPERIENCE_RATE = 150;

// The weapon types a villager can wield.
export const VILLAGER_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a villager carries into battle: bare fists (which never break) and
// the potions.
export const VILLAGER_ITEMS: Inventory = Object.freeze([weaponEntry(FISTS), ...STARTING_ITEMS]);

// The player's townsfolk-turned-fighters. Starts at level 1 with the
// villager stat line; its skills come from the 'villager' skill tree, it
// wields physical weapons, and it fights with its fists and carries the
// potions unless given other items. Levels up with the villager growth
// rates and caps, and earns XP at the villager rate.
export class Villager extends Unit {
  constructor({ name = 'Villager', team, level = 1, items = VILLAGER_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'villager',
      level,
      team,
      items,
      weaponTypes: VILLAGER_WEAPON_TYPES,
      growths: VILLAGER_GROWTHS,
      caps: VILLAGER_CAPS,
      experienceRate: VILLAGER_EXPERIENCE_RATE,
      ...VILLAGER_STATS,
    });
  }
}
