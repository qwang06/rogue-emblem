import { STARTING_ITEMS, type Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { weaponEntry, type WeaponType, WOODEN_SPEAR } from './weapons.ts';

// A specialized unit that doesn't promote: a flier (flying carpet, hot-air
// balloon, giant bird or gyrocopter, by faction) that ranges far and
// fast but is frail.
export const SCOUT_STATS = Object.freeze({
  health: 8,
  mana: 5,
  strength: 2,
  magic: 0,
  skill: 4,
  speed: 6,
  luck: 4,
  defense: 1,
  resistance: 2,
  movement: 7,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const SCOUT_GROWTHS = Object.freeze({
  health: 50,
  mana: 40,
  strength: 30,
  magic: 10,
  skill: 45,
  speed: 60,
  luck: 50,
  defense: 15,
  resistance: 25,
});

// The most each stat can reach through level ups.
export const SCOUT_CAPS = Object.freeze({
  health: 35,
  mana: 30,
  strength: 20,
  magic: 20,
  skill: 20,
  speed: 25,
  luck: 25,
  defense: 20,
  resistance: 20,
});

// The weapon types it can wield.
export const SCOUT_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What it carries into battle: a Wooden Spear and the potions.
export const SCOUT_ITEMS: Inventory = Object.freeze([weaponEntry(WOODEN_SPEAR), ...STARTING_ITEMS]);

// Starts at level 1 with the stat line above; its skills come from the
// 'scout' skill tree. Levels up with the growth rates and caps above.
export class Scout extends Unit {
  constructor({ name = 'Scout', team, level = 1, items = SCOUT_ITEMS, faction }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'scout',
      level,
      team,
      faction,
      items,
      weaponTypes: SCOUT_WEAPON_TYPES,
      growths: SCOUT_GROWTHS,
      caps: SCOUT_CAPS,
      ...SCOUT_STATS,
    });
  }
}
