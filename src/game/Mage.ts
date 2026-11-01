import { STARTING_ITEMS, type Inventory } from './items.ts';
import { applyModifiers, type Modifier } from './modifiers.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { FIRE_SPELL, weaponEntry, type WeaponType } from './weapons.ts';

// The acolyte's attack-minded promotion: more intelligence, mana and skill
// than an acolyte, just as frail.
export const MAGE_STATS = Object.freeze({
  health: 8,
  mana: 7,
  strength: 1,
  intelligence: 5,
  skill: 3,
  speed: 3,
  luck: 4,
  defense: 1,
  resistance: 4,
  movement: 5,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const MAGE_GROWTHS = Object.freeze({
  health: 50,
  mana: 100,
  strength: 0,
  intelligence: 100,
  skill: 50,
  speed: 25,
  luck: 25,
  defense: 25,
  resistance: 50,
});

// The weapon types a mage can wield: magical ones, like the acolyte.
export const MAGE_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['magical']);

// What a fresh mage carries into battle: the Fire spell it knows and the
// potions.
export const MAGE_ITEMS: Inventory = Object.freeze([weaponEntry(FIRE_SPELL), ...STARTING_ITEMS]);

// The class's passive, carried into every battle (an acolyte gains it by
// promoting, see promotions.ts).
export const MAGE_PASSIVE: { name: string; description: string; modifiers: readonly Modifier[] } = Object.freeze({
  name: 'Arcane Might',
  description: '+2 damage.',
  modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'combat', term: 'damage', amount: 2 })]),
});

// The battle caster. Starts at level 1 with the mage stat line; its skills
// come from the 'mage' skill tree (the acolyte's, then its own), it wields
// tomes and spells, and it knows Fire and carries the potions unless given
// other items. Levels up with the mage growth rates.
export class Mage extends Unit {
  constructor({ name = 'Mage', team, level = 1, items = MAGE_ITEMS, faction }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'mage',
      level,
      team,
      faction,
      items,
      weaponTypes: MAGE_WEAPON_TYPES,
      growths: MAGE_GROWTHS,
      ...MAGE_STATS,
    });
    applyModifiers(this, MAGE_PASSIVE.modifiers);
  }
}
