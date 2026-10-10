import type { Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { CLUB, weaponEntry, type WeaponType } from './weapons.ts';

// A quick, scrappy monster: fast on its feet and hits about as hard as a
// soldier, but frail.
export const GOBLIN_STATS = Object.freeze({
  health: 8,
  mana: 0,
  strength: 3,
  magic: 0,
  skill: 4,
  speed: 5,
  luck: 1,
  defense: 1,
  resistance: 0,
  movement: 5,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const GOBLIN_GROWTHS = Object.freeze({
  health: 60,
  mana: 0,
  strength: 40,
  magic: 0,
  skill: 45,
  speed: 50,
  luck: 25,
  defense: 20,
  resistance: 10,
});

// The most each stat can reach through level ups.
export const GOBLIN_CAPS = Object.freeze({
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

// The weapon types a goblin can wield.
export const GOBLIN_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a goblin carries into battle: only its Club, which never breaks.
// Monsters carry no potions.
export const GOBLIN_ITEMS: Inventory = Object.freeze([weaponEntry(CLUB)]);

// A monster, met as an enemy in Warband Mode. Starts at level 1 with the
// goblin stat line and no mana; it has no skill tree, wields physical
// weapons, and fights with its Club unless given other items.
export class Goblin extends Unit {
  constructor({ name = 'Goblin', team, level = 1, items = GOBLIN_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'goblin',
      level,
      team,
      items,
      weaponTypes: GOBLIN_WEAPON_TYPES,
      growths: GOBLIN_GROWTHS,
      caps: GOBLIN_CAPS,
      ...GOBLIN_STATS,
    });
  }
}
