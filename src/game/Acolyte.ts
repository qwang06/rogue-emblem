import { HEAL_STAFF, staffEntry } from './healing.ts';
import { STARTING_ITEMS, type Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { LIGHT, weaponEntry, type WeaponType } from './weapons.ts';

// Frail and steady: intelligence and resistance to heal and endure spells, high
// luck, little strength or defense.
export const ACOLYTE_STATS = Object.freeze({
  health: 8,
  mana: 6,
  strength: 1,
  intelligence: 3,
  dexterity: 2,
  speed: 3,
  luck: 4,
  defense: 1,
  resistance: 4,
  movement: 5,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const ACOLYTE_GROWTHS = Object.freeze({
  health: 50,
  mana: 75,
  strength: 0,
  intelligence: 100,
  dexterity: 25,
  speed: 25,
  luck: 25,
  defense: 25,
  resistance: 50,
});

// The weapon types an acolyte can wield: magical ones, i.e. its Light
// spell, tomes (see tomes.ts) and the spells they teach.
export const ACOLYTE_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['staff', 'tome']);

// What an acolyte carries into battle: the Light spell it knows, its Heal
// staff and the potions.
export const ACOLYTE_ITEMS: Inventory = Object.freeze([weaponEntry(LIGHT), staffEntry(HEAL_STAFF), ...STARTING_ITEMS]);

// The healer. Starts at level 1 with the acolyte stat line; its skills come
// from the 'acolyte' skill tree (none yet), it wields tomes and spells,
// and it knows Light and carries a Heal staff (see healing.ts) and the
// potions unless given other items. Levels up with the acolyte growth rates.
export class Acolyte extends Unit {
  constructor({ name = 'Acolyte', team, level = 1, items = ACOLYTE_ITEMS, faction }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'acolyte',
      level,
      team,
      faction,
      items,
      weaponTypes: ACOLYTE_WEAPON_TYPES,
      growths: ACOLYTE_GROWTHS,
      ...ACOLYTE_STATS,
    });
  }
}
