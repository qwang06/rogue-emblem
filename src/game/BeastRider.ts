import { STARTING_ITEMS, type Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { IRON_SPEAR, weaponEntry, type WeaponType } from './weapons.ts';

// A special unit of its own kind: a rider on a winged beast, by faction
// the same mount as the Beast. Strong and fast, with a long reach of
// movement.
export const BEAST_RIDER_STATS = Object.freeze({
  health: 12,
  mana: 5,
  strength: 5,
  intelligence: 0,
  dexterity: 4,
  speed: 5,
  luck: 3,
  defense: 3,
  resistance: 2,
  movement: 7,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const BEAST_RIDER_GROWTHS = Object.freeze({
  health: 75,
  mana: 25,
  strength: 50,
  intelligence: 0,
  dexterity: 50,
  speed: 100,
  luck: 25,
  defense: 25,
  resistance: 25,
});

// The weapon types it can wield.
export const BEAST_RIDER_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['spear']);

// What it carries into battle: an Iron Spear and the potions.
export const BEAST_RIDER_ITEMS: Inventory = Object.freeze([weaponEntry(IRON_SPEAR), ...STARTING_ITEMS]);

// Starts at level 1 with the stat line above; its skills come from the
// 'beast-rider' skill tree. Levels up with the growth rates above.
export class BeastRider extends Unit {
  constructor({ name = 'Beast Rider', team, level = 1, items = BEAST_RIDER_ITEMS, faction }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'beast-rider',
      level,
      team,
      faction,
      items,
      weaponTypes: BEAST_RIDER_WEAPON_TYPES,
      growths: BEAST_RIDER_GROWTHS,
      ...BEAST_RIDER_STATS,
    });
  }
}
