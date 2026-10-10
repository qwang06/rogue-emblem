import type { Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { TACKLE, weaponEntry, type WeaponType } from './weapons.ts';

// The weakest monster: a slow blob of jelly that barely scratches. Soft all
// over, though a little magic slides off it.
export const SLIME_STATS = Object.freeze({
  health: 6,
  mana: 0,
  strength: 3,
  magic: 0,
  skill: 1,
  speed: 1,
  luck: 0,
  defense: 0,
  resistance: 2,
  movement: 3,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const SLIME_GROWTHS = Object.freeze({
  health: 60,
  mana: 0,
  strength: 30,
  magic: 0,
  skill: 20,
  speed: 20,
  luck: 10,
  defense: 20,
  resistance: 30,
});

// The most each stat can reach through level ups.
export const SLIME_CAPS = Object.freeze({
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

// The weapon types a slime can wield.
export const SLIME_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a slime carries into battle: only its Tackle, which never breaks.
// Monsters carry no potions.
export const SLIME_ITEMS: Inventory = Object.freeze([weaponEntry(TACKLE)]);

// A monster, met as an enemy in Warband Mode. Starts at level 1 with the
// slime stat line and no mana; it has no skill tree, wields physical
// weapons, and fights with its Tackle unless given other items.
export class Slime extends Unit {
  constructor({ name = 'Slime', team, level = 1, items = SLIME_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'slime',
      level,
      team,
      items,
      weaponTypes: SLIME_WEAPON_TYPES,
      growths: SLIME_GROWTHS,
      caps: SLIME_CAPS,
      ...SLIME_STATS,
    });
  }
}
