import type { Inventory } from './items.ts';
import { applyModifiers, type Modifier } from './modifiers.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { STONE_MAUL, weaponEntry, type WeaponType } from './weapons.ts';

// The wall of a monster: the most HP of any monster bar the dragon, slow
// and clumsy, and it closes its wounds every turn, so it has to be
// brought down in one push rather than worn down.
export const TROLL_STATS = Object.freeze({
  health: 18,
  mana: 0,
  strength: 4,
  intelligence: 0,
  dexterity: 1,
  speed: 1,
  luck: 0,
  defense: 3,
  resistance: 1,
  movement: 4,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const TROLL_GROWTHS = Object.freeze({
  health: 100,
  mana: 0,
  strength: 45,
  intelligence: 0,
  dexterity: 15,
  speed: 10,
  luck: 10,
  defense: 40,
  resistance: 15,
});

// The weapon types a troll can wield.
export const TROLL_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['natural']);

// What a troll carries into battle: only its Stone Maul, which never
// breaks. Monsters carry no potions.
export const TROLL_ITEMS: Inventory = Object.freeze([weaponEntry(STONE_MAUL)]);

// The troll's passive, carried into every battle: it regains HP at the
// start of each of its phases (see the phase-heal modifier).
export const TROLL_PASSIVE: { name: string; description: string; modifiers: readonly Modifier[] } = Object.freeze({
  name: 'Regeneration',
  description: 'Regains 3 HP at the start of each of its phases.',
  modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'phase-heal', amount: 3 })]),
});

// A monster, met as an enemy in Warband Mode. Starts at level 1 with the
// troll stat line and no mana; it has no skill tree, wields physical
// weapons, fights with its Stone Maul unless given other items, and
// regenerates.
export class Troll extends Unit {
  override monster = true;

  constructor({ name = 'Troll', team, level = 1, items = TROLL_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'troll',
      level,
      team,
      faction: null,
      items,
      weaponTypes: TROLL_WEAPON_TYPES,
      growths: TROLL_GROWTHS,
      ...TROLL_STATS,
    });
    applyModifiers(this, TROLL_PASSIVE.modifiers);
  }
}
