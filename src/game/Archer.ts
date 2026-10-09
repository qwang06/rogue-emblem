import { STARTING_ITEMS, type Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { IRON_BOW, weaponEntry, type WeaponType } from './weapons.ts';

// Frail and accurate: more skill and speed than a soldier, less health,
// strength and defense.
export const ARCHER_STATS = Object.freeze({
  health: 9,
  mana: 5,
  strength: 3,
  magic: 0,
  skill: 5,
  speed: 4,
  luck: 2,
  defense: 1,
  resistance: 1,
  movement: 5,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const ARCHER_GROWTHS = Object.freeze({
  health: 60,
  mana: 40,
  strength: 40,
  magic: 5,
  skill: 55,
  speed: 45,
  luck: 35,
  defense: 20,
  resistance: 20,
});

// The most each stat can reach through level ups.
export const ARCHER_CAPS = Object.freeze({
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

// The weapon types an archer can wield.
export const ARCHER_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What an archer carries into battle: its bow and the potions.
export const ARCHER_ITEMS: Inventory = Object.freeze([weaponEntry(IRON_BOW), ...STARTING_ITEMS]);

// The ranged infantry. Starts at level 1 with the archer stat line; its
// skills come from the 'archer' skill tree, it wields physical weapons,
// and it carries an Iron Bow (range 2 only, so it can't strike or counter
// adjacent foes) and the potions unless given other items. Levels up with
// the archer growth rates and caps.
export class Archer extends Unit {
  constructor({ name = 'Archer', team, level = 1, items = ARCHER_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'archer',
      level,
      team,
      items,
      weaponTypes: ARCHER_WEAPON_TYPES,
      growths: ARCHER_GROWTHS,
      caps: ARCHER_CAPS,
      ...ARCHER_STATS,
    });
  }
}
