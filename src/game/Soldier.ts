import { STARTING_ITEMS, type Inventory } from './items.ts';
import { applyModifiers, type Modifier } from './modifiers.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { IRON_SPEAR, weaponEntry, type WeaponType } from './weapons.ts';

export const SOLDIER_STATS = Object.freeze({
  health: 10,
  mana: 5,
  strength: 4,
  intelligence: 0,
  dexterity: 3,
  speed: 3,
  luck: 2,
  defense: 2,
  resistance: 0,
  movement: 5,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const SOLDIER_GROWTHS = Object.freeze({
  health: 75,
  mana: 25,
  strength: 50,
  intelligence: 0,
  dexterity: 25,
  speed: 25,
  luck: 25,
  defense: 100,
  resistance: 25,
});

// The weapon types a soldier can wield.
export const SOLDIER_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['spear', 'sword']);

// What a soldier carries into battle: its spear and the potions.
export const SOLDIER_ITEMS: Inventory = Object.freeze([weaponEntry(IRON_SPEAR), ...STARTING_ITEMS]);

// The class's passive, carried into every battle (a villager gains it by
// promoting, see promotions.ts).
export const SOLDIER_PASSIVE: { name: string; description: string; modifiers: readonly Modifier[] } = Object.freeze({
  name: 'Shield Wall',
  description: 'Takes 1 less damage when attacked.',
  modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'combat', term: 'guard', amount: 1, when: 'defending' })]),
});

// The basic spear-and-shield infantry. Starts at level 1 with the soldier
// stat line; its skills come from the 'soldier' skill tree, it wields
// physical weapons, and it carries an Iron Spear and the potions unless
// given other items. Levels up with the soldier growth rates.
export class Soldier extends Unit {
  constructor({ name = 'Soldier', team, level = 1, items = SOLDIER_ITEMS, faction }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'soldier',
      level,
      team,
      faction,
      items,
      weaponTypes: SOLDIER_WEAPON_TYPES,
      growths: SOLDIER_GROWTHS,
      ...SOLDIER_STATS,
    });
    applyModifiers(this, SOLDIER_PASSIVE.modifiers);
  }
}
