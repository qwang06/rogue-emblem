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
  skill: 4,
  speed: 5,
  luck: 3,
  defense: 3,
  resistance: 2,
  movement: 7,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const BEAST_RIDER_GROWTHS = Object.freeze({
  health: 70,
  mana: 40,
  strength: 50,
  intelligence: 5,
  skill: 45,
  speed: 50,
  luck: 35,
  defense: 30,
  resistance: 20,
});

// The most each stat can reach through level ups.
export const BEAST_RIDER_CAPS = Object.freeze({
  health: 45,
  mana: 30,
  strength: 22,
  intelligence: 20,
  skill: 22,
  speed: 22,
  luck: 20,
  defense: 22,
  resistance: 20,
});

// The weapon types it can wield.
export const BEAST_RIDER_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What it carries into battle: an Iron Spear and the potions.
export const BEAST_RIDER_ITEMS: Inventory = Object.freeze([weaponEntry(IRON_SPEAR), ...STARTING_ITEMS]);

// Starts at level 1 with the stat line above; its skills come from the
// 'beast-rider' skill tree. Levels up with the growth rates and caps above.
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
      caps: BEAST_RIDER_CAPS,
      ...BEAST_RIDER_STATS,
    });
  }
}
