import type { Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { GREAT_AXE, weaponEntry, type WeaponType } from './weapons.ts';

// The charging monster: as strong as an orc but quick and far-ranging,
// paid for with thinner hide, so it reaches the back line and often
// strikes twice, but drops faster when it's caught.
export const MINOTAUR_STATS = Object.freeze({
  health: 13,
  mana: 0,
  strength: 5,
  intelligence: 0,
  dexterity: 4,
  speed: 5,
  luck: 2,
  defense: 1,
  resistance: 0,
  movement: 6,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const MINOTAUR_GROWTHS = Object.freeze({
  health: 70,
  mana: 0,
  strength: 50,
  intelligence: 0,
  dexterity: 35,
  speed: 40,
  luck: 15,
  defense: 20,
  resistance: 10,
});

// The weapon types a minotaur can wield.
export const MINOTAUR_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a minotaur carries into battle: only its Great Axe, which never
// breaks. Monsters carry no potions.
export const MINOTAUR_ITEMS: Inventory = Object.freeze([weaponEntry(GREAT_AXE)]);

// A monster, met as an enemy in Warband Mode. Starts at level 1 with the
// minotaur stat line and no mana; it has no skill tree, wields physical
// weapons, and fights with its Great Axe unless given other items.
export class Minotaur extends Unit {
  override monster = true;

  constructor({ name = 'Minotaur', team, level = 1, items = MINOTAUR_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'minotaur',
      level,
      team,
      faction: null,
      items,
      weaponTypes: MINOTAUR_WEAPON_TYPES,
      growths: MINOTAUR_GROWTHS,
      ...MINOTAUR_STATS,
    });
  }
}
