import type { Inventory } from './items.ts';
import { applyModifiers, type Modifier } from './modifiers.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import { TACKLE, weaponEntry, type WeaponType } from './weapons.ts';

// The weakest monster: a slow blob of jelly that barely scratches. Soft all
// over, though a little magic slides off it.
export const SLIME_STATS = Object.freeze({
  health: 6,
  mana: 0,
  strength: 3,
  intelligence: 0,
  dexterity: 1,
  speed: 1,
  luck: 0,
  defense: 0,
  resistance: 2,
  movement: 3,
});

// How fast each stat grows, on a fixed schedule with no dice: 100 is a
// point every level, 50 every second level, 25 every fourth (see
// getLevelUpGains in experience.ts).
export const SLIME_GROWTHS = Object.freeze({
  health: 60,
  mana: 0,
  strength: 30,
  intelligence: 0,
  dexterity: 20,
  speed: 20,
  luck: 10,
  defense: 20,
  resistance: 30,
});

// The weapon types a slime can wield.
export const SLIME_WEAPON_TYPES: readonly WeaponType[] = Object.freeze(['physical']);

// What a slime carries into battle: only its Tackle, which never breaks.
// Monsters carry no potions.
export const SLIME_ITEMS: Inventory = Object.freeze([weaponEntry(TACKLE)]);

// The slime's passive: its Tackle bounces whoever it lands on a tile back,
// onto spikes or into deep water if they're there (see push.ts).
export const SLIME_PASSIVE: { name: string; description: string; modifiers: readonly Modifier[] } = Object.freeze({
  name: 'Bounce',
  description: 'A hit in its own attack shoves the target a tile back.',
  modifiers: Object.freeze([Object.freeze<Modifier>({ kind: 'shove-on-attack' })]),
});

// A monster, met as an enemy in Warband Mode. Starts at level 1 with the
// slime stat line and no mana; it has no skill tree, wields physical
// weapons, and fights with its Tackle unless given other items; its hits
// shove (SLIME_PASSIVE).
export class Slime extends Unit {
  override monster = true;

  constructor({ name = 'Slime', team, level = 1, items = SLIME_ITEMS }: ClassUnitOptions) {
    super({
      name,
      unitClass: 'slime',
      level,
      team,
      faction: null,
      items,
      weaponTypes: SLIME_WEAPON_TYPES,
      growths: SLIME_GROWTHS,
      ...SLIME_STATS,
    });
    applyModifiers(this, SLIME_PASSIVE.modifiers);
  }
}
