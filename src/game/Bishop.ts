import { HEAL_STAFF, staffEntry } from './healing.ts';
import { STARTING_ITEMS, type Inventory } from './items.ts';
import { applyModifiers, type Modifier } from './modifiers.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { LIGHT, weaponEntry, type WeaponType } from './weapons.ts';

// The acolyte's healing promotion: sturdier than an acolyte against
// magic, with a deeper well of mana and more luck, but no more INT than a
// mage reaches. It heals and outlasts rather than strikes.
export const BISHOP_STATS = Object.freeze({
  health: 9,
  mana: 8,
  strength: 1,
  intelligence: 4,
  dexterity: 2,
  speed: 3,
  luck: 5,
  defense: 2,
  resistance: 6,
  movement: 5,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const BISHOP_GROWTHS = Object.freeze({
  health: 60,
  mana: 100,
  strength: 0,
  intelligence: 75,
  dexterity: 25,
  speed: 25,
  luck: 50,
  defense: 25,
  resistance: 75,
});

// The weapon types a bishop can wield: magical ones, like the acolyte.
export const BISHOP_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['staff', 'tome']);

// What a fresh bishop carries into battle: the Light spell it knows, a
// Heal staff and the potions.
export const BISHOP_ITEMS: Inventory = Object.freeze([weaponEntry(LIGHT), staffEntry(HEAL_STAFF), ...STARTING_ITEMS]);

// The class's passive, carried into every battle (an acolyte gains it by
// promoting, see promotions.ts).
export const BISHOP_PASSIVE: { name: string; description: string; modifiers: readonly Modifier[] } = Object.freeze({
  name: 'Devotion',
  description: 'Regains 1 MP at the start of each of its phases.',
  modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'phase-mana', amount: 1 })]),
});

// The healer, promoted. Starts at level 1 with the bishop stat line; its
// skills come from the 'bishop' skill tree (the acolyte's, then its own),
// it wields tomes and spells, and it knows Light and carries a Heal staff
// and the potions unless given other items. Levels up with the bishop
// growth rates.
export class Bishop extends Unit {
  constructor({ name = 'Bishop', team, level = 1, items = BISHOP_ITEMS, faction }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'bishop',
      level,
      team,
      faction,
      items,
      weaponTypes: BISHOP_WEAPON_TYPES,
      growths: BISHOP_GROWTHS,
      ...BISHOP_STATS,
    });
    applyModifiers(this, BISHOP_PASSIVE.modifiers);
  }
}
