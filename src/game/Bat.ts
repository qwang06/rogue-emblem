import type { Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { FANGS, weaponEntry, type WeaponType } from './weapons.ts';

// A nimble flier: the hardest monster to hit and quick to strike twice,
// but frail and weak.
export const BAT_STATS = Object.freeze({
  health: 7,
  mana: 0,
  strength: 2,
  magic: 0,
  skill: 3,
  speed: 6,
  luck: 3,
  defense: 0,
  resistance: 1,
  movement: 5,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const BAT_GROWTHS = Object.freeze({
  health: 50,
  mana: 0,
  strength: 30,
  magic: 0,
  skill: 40,
  speed: 55,
  luck: 35,
  defense: 10,
  resistance: 20,
});

// The most each stat can reach through level ups.
export const BAT_CAPS = Object.freeze({
  health: 40,
  mana: 0,
  strength: 20,
  magic: 20,
  skill: 20,
  speed: 20,
  luck: 20,
  defense: 20,
  resistance: 20,
});

// The weapon types a bat can wield.
export const BAT_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a bat carries into battle: only its Fangs, which never breaks.
// Monsters carry no potions.
export const BAT_ITEMS: Inventory = Object.freeze([weaponEntry(FANGS)]);

// A monster, met as an enemy in Warband Mode. Starts at level 1 with the
// bat stat line and no mana; it has no skill tree, wields physical
// weapons, and fights with its Fangs unless given other items.
export class Bat extends Unit {
  constructor({ name = 'Bat', team, level = 1, items = BAT_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'bat',
      level,
      team,
      items,
      weaponTypes: BAT_WEAPON_TYPES,
      growths: BAT_GROWTHS,
      caps: BAT_CAPS,
      ...BAT_STATS,
    });
  }
}
