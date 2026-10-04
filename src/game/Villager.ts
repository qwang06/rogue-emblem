import { STARTING_ITEMS, type Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { FISTS, weaponEntry, type WeaponType } from './weapons.ts';

// For now a villager fights like a soldier: the same stat line, growth
// rates and caps. Tune these to give the class its own identity.
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
export const VILLAGER_CAPS = Object.freeze({
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

// The weapon types a villager can wield.
export const VILLAGER_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a villager carries into battle: bare fists (which never break) and
// the potions.
export const VILLAGER_ITEMS: Inventory = Object.freeze([weaponEntry(FISTS), ...STARTING_ITEMS]);

// The player's townsfolk-turned-fighters. Starts at level 1 with the
// villager stat line; its skills come from the 'villager' skill tree, it
// wields physical weapons, and it fights with its fists and carries the
// potions unless given other items. Levels up with the villager growth
// rates and caps.
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
      ...VILLAGER_STATS,
    });
  }
}
