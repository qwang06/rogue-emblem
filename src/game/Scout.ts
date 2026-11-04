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
  intelligence: 0,
  dexterity: 4,
  speed: 6,
  luck: 4,
  defense: 1,
  resistance: 2,
  movement: 7,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const SCOUT_GROWTHS = Object.freeze({
  health: 50,
  mana: 25,
  strength: 25,
  intelligence: 0,
  dexterity: 25,
  speed: 100,
  luck: 100,
  defense: 0,
  resistance: 25,
});

// The weapon types it can wield.
export const SCOUT_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['spear', 'dagger']);

// What it carries into battle: a Wooden Spear and the potions.
export const SCOUT_ITEMS: Inventory = Object.freeze([weaponEntry(WOODEN_SPEAR), ...STARTING_ITEMS]);

// Starts at level 1 with the stat line above; its skills come from the
// 'scout' skill tree. Levels up with the growth rates above.
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
      ...SCOUT_STATS,
    });
  }
}
