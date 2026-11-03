import type { Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { BALLISTA, weaponEntry, type WeaponType } from './weapons.ts';

// A specialized unit that doesn't promote: a siege engine on wheels
// (crystal cannon, mortar, ballista or catapult, by faction). Strikes from
// two or three tiles away and is helpless up close; slow and plodding.
export const SIEGE_STATS = Object.freeze({
  health: 12,
  mana: 4,
  strength: 5,
  intelligence: 0,
  dexterity: 3,
  speed: 1,
  luck: 0,
  defense: 3,
  resistance: 0,
  movement: 3,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const SIEGE_GROWTHS = Object.freeze({
  health: 50,
  mana: 50,
  strength: 100,
  intelligence: 0,
  dexterity: 50,
  speed: 0,
  luck: 0,
  defense: 25,
  resistance: 0,
});

// The weapon types it can wield.
export const SIEGE_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['siege']);

// What it carries into battle: a Ballista.
export const SIEGE_ITEMS: Inventory = Object.freeze([weaponEntry(BALLISTA)]);

// Starts at level 1 with the stat line above; its skills come from the
// 'siege' skill tree. Levels up with the growth rates above.
export class Siege extends Unit {
  constructor({ name = 'Siege', team, level = 1, items = SIEGE_ITEMS, faction }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'siege',
      level,
      team,
      faction,
      items,
      weaponTypes: SIEGE_WEAPON_TYPES,
      growths: SIEGE_GROWTHS,
      ...SIEGE_STATS,
    });
  }
}
