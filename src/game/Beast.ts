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
  magic: 0,
  skill: 2,
  speed: 4,
  luck: 1,
  defense: 2,
  resistance: 1,
  movement: 6,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const BEAST_GROWTHS = Object.freeze({
  health: 80,
  mana: 20,
  strength: 55,
  magic: 0,
  skill: 35,
  speed: 45,
  luck: 25,
  defense: 35,
  resistance: 15,
});

// The most each stat can reach through level ups.
export const BEAST_CAPS = Object.freeze({
  health: 45,
  mana: 20,
  strength: 22,
  magic: 20,
  skill: 20,
  speed: 22,
  luck: 20,
  defense: 22,
  resistance: 20,
});

// The weapon types it can wield.
export const BEAST_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What it carries into battle: only its Bite, which never breaks.
export const BEAST_ITEMS: Inventory = Object.freeze([weaponEntry(BITE)]);

// Starts at level 1 with the stat line above; its skills come from the
// 'beast' skill tree. Levels up with the growth rates and caps above.
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
      caps: BEAST_CAPS,
      ...BEAST_STATS,
    });
  }
}
