import type { Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { FIRE_BREATH, weaponEntry, type WeaponType } from './weapons.ts';

// The red dragon: a boss-sized monster with the most HP and armor of any,
// whose Fire Breath reaches a tile further than a claw would, so it
// answers archers too. Slow, so quick units can still strike it twice.
export const DRAGON_STATS = Object.freeze({
  health: 22,
  mana: 0,
  strength: 7,
  intelligence: 0,
  dexterity: 4,
  speed: 3,
  luck: 2,
  defense: 5,
  resistance: 3,
  movement: 4,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const DRAGON_GROWTHS = Object.freeze({
  health: 90,
  mana: 0,
  strength: 50,
  intelligence: 0,
  dexterity: 30,
  speed: 20,
  luck: 15,
  defense: 40,
  resistance: 30,
});

// The weapon types a dragon can wield.
export const DRAGON_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['natural']);

// What a dragon carries into battle: only its Fire Breath, which never
// runs out. Monsters carry no potions.
export const DRAGON_ITEMS: Inventory = Object.freeze([weaponEntry(FIRE_BREATH)]);

// A monster, met as an enemy in Warband Mode: the Red Dragon boss of the
// Dragon's Roost (bosses.ts). Starts at level 1 with the dragon stat line
// and no mana; it has no skill tree and fights with its Fire Breath.
export class Dragon extends Unit {
  override monster = true;

  constructor({ name = 'Dragon', team, level = 1, items = DRAGON_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'dragon',
      level,
      team,
      faction: null,
      items,
      weaponTypes: DRAGON_WEAPON_TYPES,
      growths: DRAGON_GROWTHS,
      ...DRAGON_STATS,
    });
  }
}
