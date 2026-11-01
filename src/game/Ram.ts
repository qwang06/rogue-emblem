import type { Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { TACKLE, weaponEntry, type WeaponType } from './weapons.ts';

// A specialized unit that doesn't promote: a covered battering ram. Heavy
// and hard to dent, it slams whatever stands in front of it.
export const RAM_STATS = Object.freeze({
  health: 16,
  mana: 4,
  strength: 6,
  intelligence: 0,
  skill: 1,
  speed: 0,
  luck: 0,
  defense: 5,
  resistance: 0,
  movement: 4,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const RAM_GROWTHS = Object.freeze({
  health: 100,
  mana: 25,
  strength: 50,
  intelligence: 0,
  skill: 0,
  speed: 0,
  luck: 0,
  defense: 100,
  resistance: 0,
});

// The weapon types it can wield.
export const RAM_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What it carries into battle: only its Tackle, which never breaks.
export const RAM_ITEMS: Inventory = Object.freeze([weaponEntry(TACKLE)]);

// Starts at level 1 with the stat line above; its skills come from the
// 'ram' skill tree. Levels up with the growth rates above.
export class Ram extends Unit {
  constructor({ name = 'Ram', team, level = 1, items = RAM_ITEMS, faction }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'ram',
      level,
      team,
      faction,
      items,
      weaponTypes: RAM_WEAPON_TYPES,
      growths: RAM_GROWTHS,
      ...RAM_STATS,
    });
  }
}
