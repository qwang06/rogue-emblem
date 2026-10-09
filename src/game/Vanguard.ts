import { STARTING_ITEMS, type Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { IRON_AXE, weaponEntry, type WeaponType } from './weapons.ts';

// Brawny and wild: more health and strength than a soldier (enough to
// swing an Iron Axe unslowed), less skill, speed and luck.
export const VANGUARD_STATS = Object.freeze({
  health: 12,
  mana: 5,
  strength: 5,
  magic: 0,
  skill: 2,
  speed: 2,
  luck: 1,
  defense: 2,
  resistance: 0,
  movement: 5,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const VANGUARD_GROWTHS = Object.freeze({
  health: 85,
  mana: 30,
  strength: 55,
  magic: 0,
  skill: 30,
  speed: 30,
  luck: 25,
  defense: 30,
  resistance: 10,
});

// The most each stat can reach through level ups.
export const VANGUARD_CAPS = Object.freeze({
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

// The weapon types a vanguard can wield.
export const VANGUARD_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a vanguard carries into battle: its axe and the potions.
export const VANGUARD_ITEMS: Inventory = Object.freeze([weaponEntry(IRON_AXE), ...STARTING_ITEMS]);

// The axe-wielding front line. Starts at level 1 with the vanguard stat
// line; its skills come from the 'vanguard' skill tree, it wields physical
// weapons, and it carries an Iron Axe (hard-hitting but inaccurate) and
// the potions unless given other items. Levels up with the vanguard growth
// rates and caps.
export class Vanguard extends Unit {
  constructor({ name = 'Vanguard', team, level = 1, items = VANGUARD_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'vanguard',
      level,
      team,
      items,
      weaponTypes: VANGUARD_WEAPON_TYPES,
      growths: VANGUARD_GROWTHS,
      caps: VANGUARD_CAPS,
      ...VANGUARD_STATS,
    });
  }
}
