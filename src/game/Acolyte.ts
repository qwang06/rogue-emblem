import { HEAL_STAFF, staffEntry } from './healing.ts';
import { STARTING_ITEMS, type Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import type { WeaponType } from './weapons.ts';

// Frail and steady: magic and resistance to heal and endure spells, high
// luck, little strength or defense.
export const ACOLYTE_STATS = Object.freeze({
  health: 8,
  mana: 6,
  strength: 1,
  magic: 3,
  skill: 2,
  speed: 3,
  luck: 4,
  defense: 1,
  resistance: 4,
  movement: 5,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const ACOLYTE_GROWTHS = Object.freeze({
  health: 50,
  mana: 50,
  strength: 10,
  magic: 50,
  skill: 30,
  speed: 40,
  luck: 50,
  defense: 15,
  resistance: 45,
});

// The most each stat can reach through level ups.
export const ACOLYTE_CAPS = Object.freeze({
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

// The weapon types an acolyte can wield: magical ones, i.e. tomes (see
// tomes.ts) and the spells they teach. It starts with none, healing with a
// staff, which isn't a weapon, so until it finds a tome it can't attack or
// counter.
export const ACOLYTE_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['magical']);

// What an acolyte carries into battle: its Heal staff and the potions.
export const ACOLYTE_ITEMS: Inventory = Object.freeze([staffEntry(HEAL_STAFF), ...STARTING_ITEMS]);

// The healer. Starts at level 1 with the acolyte stat line; its skills come
// from the 'acolyte' skill tree (none yet), it wields tomes and spells
// but starts with none, and it carries a Heal staff (see healing.ts) and the potions unless given other
// items. Levels up with the acolyte growth rates and caps.
export class Acolyte extends Unit {
  constructor({ name = 'Acolyte', team, level = 1, items = ACOLYTE_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'acolyte',
      level,
      team,
      items,
      weaponTypes: ACOLYTE_WEAPON_TYPES,
      growths: ACOLYTE_GROWTHS,
      caps: ACOLYTE_CAPS,
      ...ACOLYTE_STATS,
    });
  }
}
