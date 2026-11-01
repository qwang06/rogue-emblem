import type { Inventory } from './items.ts';
import { Unit, type ClassUnitOptions } from './Unit.ts';
import type { GrowthTable } from './experience.ts';
import { FIRE_SPELL, LIGHT, TACKLE, weaponEntry, type Weapon, type WeaponType } from './weapons.ts';

// The elementals: neutral units that belong to no faction, one class per
// element. Each fights with a natural weapon that never breaks and carries
// nothing else.

export type ElementalKind = 'water' | 'fire' | 'air' | 'earth';

export const ELEMENTAL_KINDS: readonly ElementalKind[] = Object.freeze(['water', 'fire', 'air', 'earth']);

export interface ElementalLine {
  label: string;
  stats: {
    health: number;
    mana: number;
    strength: number;
    intelligence: number;
    skill: number;
    speed: number;
    luck: number;
    defense: number;
    resistance: number;
    movement: number;
  };
  growths: GrowthTable;
  weapon: Weapon;
}

// Each element's stat line, growths and weapon.
export const ELEMENTALS: Readonly<Record<ElementalKind, ElementalLine>> = Object.freeze({
  // Water: steady and hard to hurt with spells, it mends nothing yet but
  // strikes with light from two tiles.
  water: Object.freeze<ElementalLine>({
    label: 'Water Elemental',
    stats: {
      health: 11,
      mana: 6,
      strength: 0,
      intelligence: 3,
      skill: 3,
      speed: 3,
      luck: 3,
      defense: 1,
      resistance: 4,
      movement: 5,
    },
    growths: Object.freeze({
      health: 60,
      mana: 50,
      strength: 0,
      intelligence: 45,
      skill: 35,
      speed: 35,
      luck: 35,
      defense: 15,
      resistance: 45,
    }),
    weapon: LIGHT,
  }),
  // Fire: the hardest hitter, with fire from two tiles, but frail.
  fire: Object.freeze<ElementalLine>({
    label: 'Fire Elemental',
    stats: {
      health: 9,
      mana: 6,
      strength: 0,
      intelligence: 4,
      skill: 3,
      speed: 4,
      luck: 2,
      defense: 0,
      resistance: 3,
      movement: 5,
    },
    growths: Object.freeze({
      health: 50,
      mana: 50,
      strength: 0,
      intelligence: 55,
      skill: 40,
      speed: 45,
      luck: 25,
      defense: 10,
      resistance: 35,
    }),
    weapon: FIRE_SPELL,
  }),
  // Air: the quickest and most elusive.
  air: Object.freeze<ElementalLine>({
    label: 'Air Elemental',
    stats: {
      health: 8,
      mana: 6,
      strength: 0,
      intelligence: 3,
      skill: 4,
      speed: 6,
      luck: 4,
      defense: 0,
      resistance: 3,
      movement: 6,
    },
    growths: Object.freeze({
      health: 45,
      mana: 50,
      strength: 0,
      intelligence: 40,
      skill: 45,
      speed: 60,
      luck: 45,
      defense: 10,
      resistance: 35,
    }),
    weapon: LIGHT,
  }),
  // Earth: a slow, heavy body that slams up close.
  earth: Object.freeze<ElementalLine>({
    label: 'Earth Elemental',
    stats: {
      health: 15,
      mana: 2,
      strength: 5,
      intelligence: 0,
      skill: 2,
      speed: 1,
      luck: 1,
      defense: 4,
      resistance: 1,
      movement: 4,
    },
    growths: Object.freeze({
      health: 80,
      mana: 20,
      strength: 50,
      intelligence: 0,
      skill: 30,
      speed: 10,
      luck: 15,
      defense: 45,
      resistance: 15,
    }),
    weapon: TACKLE,
  }),
});

// The class id of the `kind` elemental, e.g. 'fire-elemental'.
export function elementalClassId(kind: ElementalKind): string {
  return `${kind}-elemental`;
}

// What an elemental carries: only its natural weapon.
export function getElementalItems(kind: ElementalKind): Inventory {
  return Object.freeze([weaponEntry(ELEMENTALS[kind].weapon)]);
}

// A neutral elemental of `kind`. Starts at level 1 with its element's stat
// line, belongs to no faction (whatever `faction` says) and fights with
// its element's natural weapon. Its skills would come from its class's
// skill tree, which has none yet.
export class Elemental extends Unit {
  readonly kind: ElementalKind;

  constructor(kind: ElementalKind, { name, team, level = 1, items }: ClassUnitOptions) {
    const line = ELEMENTALS[kind];
    const weaponTypes: readonly WeaponType[] = Object.freeze([line.weapon.type]);
    super({
      name: name ?? line.label,
      unitClass: elementalClassId(kind),
      level,
      team,
      faction: null,
      items: items ?? getElementalItems(kind),
      weaponTypes,
      growths: line.growths,
      ...line.stats,
    });
    this.kind = kind;
  }
}
