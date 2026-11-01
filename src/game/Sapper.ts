import { STARTING_ITEMS, type Inventory } from './items.ts';
import { applyModifiers, type Modifier } from './modifiers.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { POWDER_KEG, weaponEntry, type WeaponType } from './weapons.ts';

// Tier 2, promoted from the villager: a bomb carrier who hauls a powder
// keg on its back and lobs it from up to two tiles. Hits hard but is
// lightly armored and has few kegs to spare.
export const SAPPER_STATS = Object.freeze({
  health: 10,
  mana: 5,
  strength: 4,
  magic: 0,
  skill: 3,
  speed: 3,
  luck: 2,
  defense: 1,
  resistance: 0,
  movement: 5,
});

// Percent chance per level up that each stat rises (see experience.ts).
export const SAPPER_GROWTHS = Object.freeze({
  health: 65,
  mana: 40,
  strength: 45,
  magic: 5,
  skill: 40,
  speed: 35,
  luck: 30,
  defense: 25,
  resistance: 15,
});

// The most each stat can reach through level ups.
export const SAPPER_CAPS = Object.freeze({
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

// The weapon types it can wield.
export const SAPPER_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical', 'siege']);

// What it carries into battle: a Powder Keg and the potions.
export const SAPPER_ITEMS: Inventory = Object.freeze([weaponEntry(POWDER_KEG), ...STARTING_ITEMS]);

// The class's passive, carried into every battle (a villager gains it by
// promoting, see promotions.ts).
export const SAPPER_PASSIVE: { name: string; description: string; modifiers: readonly Modifier[] } = Object.freeze({
  name: 'Demolitions',
  description: '+5 crit.',
  modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'combat', term: 'crit', amount: 5 })]),
});

// Starts at level 1 with the stat line above; its skills come from the
// 'sapper' skill tree. Levels up with the growth rates and caps above.
export class Sapper extends Unit {
  constructor({ name = 'Sapper', team, level = 1, items = SAPPER_ITEMS, faction }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'sapper',
      level,
      team,
      faction,
      items,
      weaponTypes: SAPPER_WEAPON_TYPES,
      growths: SAPPER_GROWTHS,
      caps: SAPPER_CAPS,
      ...SAPPER_STATS,
    });
    applyModifiers(this, SAPPER_PASSIVE.modifiers);
  }
}
