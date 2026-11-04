import { STARTING_ITEMS, type Inventory } from './items.ts';
import { applyModifiers, type Modifier } from './modifiers.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { IRON_AXE, weaponEntry, type WeaponType } from './weapons.ts';

// Brawny and wild: more health and strength than a soldier (enough to
// swing an Iron Axe unslowed), less dexterity, speed and luck.
export const VANGUARD_STATS = Object.freeze({
  health: 12,
  mana: 5,
  strength: 5,
  intelligence: 0,
  dexterity: 2,
  speed: 2,
  luck: 1,
  defense: 2,
  resistance: 0,
  movement: 5,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const VANGUARD_GROWTHS = Object.freeze({
  health: 100,
  mana: 25,
  strength: 100,
  intelligence: 0,
  dexterity: 50,
  speed: 25,
  luck: 0,
  defense: 25,
  resistance: 0,
});

// The weapon types a vanguard can wield.
export const VANGUARD_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['axe', 'sword']);

// What a vanguard carries into battle: its axe and the potions.
export const VANGUARD_ITEMS: Inventory = Object.freeze([weaponEntry(IRON_AXE), ...STARTING_ITEMS]);

// The class's passive, carried into every battle (a villager gains it by
// promoting, see promotions.ts).
export const VANGUARD_PASSIVE: { name: string; description: string; modifiers: readonly Modifier[] } = Object.freeze({
  name: 'Heavy Swing',
  description: '+1 damage.',
  modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'combat', term: 'damage', amount: 1 })]),
});

// The axe-wielding front line. Starts at level 1 with the vanguard stat
// line; its skills come from the 'vanguard' skill tree, it wields physical
// weapons, and it carries an Iron Axe (hard-hitting but inaccurate) and
// the potions unless given other items. Levels up with the vanguard growth
// rates.
export class Vanguard extends Unit {
  constructor({ name = 'Vanguard', team, level = 1, items = VANGUARD_ITEMS, faction }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'vanguard',
      level,
      team,
      faction,
      items,
      weaponTypes: VANGUARD_WEAPON_TYPES,
      growths: VANGUARD_GROWTHS,
      ...VANGUARD_STATS,
    });
    applyModifiers(this, VANGUARD_PASSIVE.modifiers);
  }
}
