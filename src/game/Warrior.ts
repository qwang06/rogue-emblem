import { STARTING_ITEMS, type Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { FISTS, weaponEntry, WOODEN_SWORD, type WeaponType } from './weapons.ts';

// The late bloomer: a common fighter in a plain tunic, no armor. A warrior
// starts a point of strength below a soldier and swings only a wooden
// sword, so early on it's the weakest pick; it makes up for that with the
// highest growth total and the highest caps of any class, and earns XP
// half again as fast (WARRIOR_EXPERIENCE_RATE), so a warrior that
// survives the early stages outgrows everyone else.
export const WARRIOR_STATS = Object.freeze({
  health: 10,
  mana: 5,
  strength: 3,
  magic: 0,
  skill: 3,
  speed: 3,
  luck: 2,
  defense: 2,
  resistance: 0,
  movement: 5,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const WARRIOR_GROWTHS = Object.freeze({
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
export const WARRIOR_CAPS = Object.freeze({
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

// Percent of each XP gain a warrior earns (see scaleExperience).
export const WARRIOR_EXPERIENCE_RATE = 150;

// The weapon types a warrior can wield.
export const WARRIOR_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a warrior carries into battle: a wooden sword, its fists (which
// never break) for when the sword does, and the potions.
export const WARRIOR_ITEMS: Inventory = Object.freeze([
  weaponEntry(WOODEN_SWORD),
  weaponEntry(FISTS),
  ...STARTING_ITEMS,
]);

// The common foot soldier. Starts at level 1 with the warrior stat line;
// its skills come from the 'warrior' skill tree, it wields physical
// weapons, and it fights with a wooden sword (then its fists) and carries
// the potions unless given other items. Levels up with the warrior growth
// rates and caps, and earns XP at the warrior rate.
export class Warrior extends Unit {
  constructor({ name = 'Warrior', team, level = 1, items = WARRIOR_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'warrior',
      level,
      team,
      items,
      weaponTypes: WARRIOR_WEAPON_TYPES,
      growths: WARRIOR_GROWTHS,
      caps: WARRIOR_CAPS,
      experienceRate: WARRIOR_EXPERIENCE_RATE,
      ...WARRIOR_STATS,
    });
  }
}
