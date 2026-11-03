import type { Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { BITE, weaponEntry, type WeaponType } from './weapons.ts';

// A specialized unit, recruited on its own: a riderless winged beast
// (wyvern, griffin, pegasus or drake, by faction) that fights with its
// bite. Tough and quick, but it carries nothing.
export const BEAST_STATS = Object.freeze({
  health: 13,
  mana: 2,
  strength: 5,
  intelligence: 0,
  dexterity: 2,
  speed: 4,
  luck: 1,
  defense: 2,
  resistance: 1,
  movement: 6,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const BEAST_GROWTHS = Object.freeze({
  health: 100,
  mana: 25,
  strength: 100,
  intelligence: 0,
  dexterity: 25,
  speed: 50,
  luck: 0,
  defense: 25,
  resistance: 25,
});

// The weapon types it can wield.
export const BEAST_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What it carries into battle: only its Bite, which never breaks.
export const BEAST_ITEMS: Inventory = Object.freeze([weaponEntry(BITE)]);

// Starts at level 1 with the stat line above; its skills come from the
// 'beast' skill tree. Levels up with the growth rates above.
export class Beast extends Unit {
  constructor({ name = 'Beast', team, level = 1, items = BEAST_ITEMS, faction }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'beast',
      level,
      team,
      faction,
      items,
      weaponTypes: BEAST_WEAPON_TYPES,
      growths: BEAST_GROWTHS,
      ...BEAST_STATS,
    });
  }
}
