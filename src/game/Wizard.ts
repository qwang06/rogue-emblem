import { STARTING_ITEMS, type Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { FIRE, weaponEntry, type WeaponType } from './weapons.ts';

// Frail and learned: magic instead of strength, resistance instead of
// defense, and a deeper pool of mana than a soldier.
export const WIZARD_STATS = Object.freeze({
  health: 8,
  mana: 8,
  strength: 1,
  magic: 4,
  skill: 3,
  speed: 3,
  luck: 2,
  defense: 0,
  resistance: 3,
  movement: 5,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const WIZARD_GROWTHS = Object.freeze({
  health: 50,
  mana: 60,
  strength: 10,
  magic: 55,
  skill: 40,
  speed: 40,
  luck: 30,
  defense: 10,
  resistance: 40,
});

// The most each stat can reach through level ups.
export const WIZARD_CAPS = Object.freeze({
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

// The weapon types a wizard can wield: spells only.
export const WIZARD_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['magical']);

// What a wizard carries into battle: its Fire tome and the potions.
export const WIZARD_ITEMS: Inventory = Object.freeze([weaponEntry(FIRE), ...STARTING_ITEMS]);

// The spellcaster. Starts at level 1 with the wizard stat line; its skills
// come from the 'wizard' skill tree, it wields magical weapons (magic
// against resistance), and it carries Fire (range 1–2) and the potions
// unless given other items. Levels up with the wizard growth rates and
// caps.
export class Wizard extends Unit {
  constructor({ name = 'Wizard', team, level = 1, items = WIZARD_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'wizard',
      level,
      team,
      items,
      weaponTypes: WIZARD_WEAPON_TYPES,
      growths: WIZARD_GROWTHS,
      caps: WIZARD_CAPS,
      ...WIZARD_STATS,
    });
  }
}
