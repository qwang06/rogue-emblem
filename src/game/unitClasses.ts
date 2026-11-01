// The unit classes the game knows how to build, in menu order. Each entry
// names the class and builds a fresh Unit of it, so menus that offer a
// choice of class (e.g. Training) don't need to know the subclasses. The
// class tree: the villager, the starting unit, comes first; then its four
// promotions (promotions.ts), which a unit becomes by promoting; then the
// specialized units (the scout, the beast, the beast rider, siege engines,
// rams and the acolyte, the only one that promotes, into the mage); then the neutral
// elementals, which belong to no faction; then the monsters (slime,
// goblin, skeleton, bat, orc, dragon), which are enemies only. Promoted classes, neutral units and monsters
// are never recruits, starting picks or Training choices (see
// PLAYABLE_CLASSES).

import { Acolyte } from './Acolyte.ts';
import { Archer } from './Archer.ts';
import { Bat } from './Bat.ts';
import { Beast } from './Beast.ts';
import { BeastRider } from './BeastRider.ts';
import { Dragon } from './Dragon.ts';
import { Elemental, ELEMENTAL_KINDS, ELEMENTALS, elementalClassId } from './Elemental.ts';
import { Goblin } from './Goblin.ts';
import { Mage } from './Mage.ts';
import { findPromotion } from './promotions.ts';
import { Orc } from './Orc.ts';
import { Ram } from './Ram.ts';
import { Sapper } from './Sapper.ts';
import { Scout } from './Scout.ts';
import { Siege } from './Siege.ts';
import { Skeleton } from './Skeleton.ts';
import { Slime } from './Slime.ts';
import { Soldier } from './Soldier.ts';
import type { ClassUnitOptions, Unit } from './Unit.ts';
import { Vanguard } from './Vanguard.ts';
import { Villager } from './Villager.ts';

export interface UnitClass {
  id: string;
  label: string;
  create: (options: ClassUnitOptions) => Unit;
  // True for an enemy-only class the player can't field.
  monster?: boolean;
  // True for a neutral class, one that belongs to no faction.
  neutral?: boolean;
  // The class a promoted class promotes from (see promotions.ts).
  promotedFrom?: string;
}

function baseClass(id: string, label: string, create: (options: ClassUnitOptions) => Unit): UnitClass {
  return Object.freeze<UnitClass>({ id, label, create });
}

function monsterClass(id: string, label: string, create: (options: ClassUnitOptions) => Unit): UnitClass {
  return Object.freeze<UnitClass>({ id, label, create, monster: true });
}

// A promoted class: a fresh one is built as its own class (which carries
// its passive, like a promoted unit does).
function promotedClass(id: string, create: (options: ClassUnitOptions) => Unit): UnitClass {
  const promotion = findPromotion(id)!;
  return Object.freeze<UnitClass>({ id, label: promotion.label, create, promotedFrom: promotion.from });
}

export const UNIT_CLASSES: readonly UnitClass[] = Object.freeze([
  baseClass('villager', 'Villager', (options) => new Villager(options)),
  promotedClass('archer', (options) => new Archer(options)),
  promotedClass('soldier', (options) => new Soldier(options)),
  promotedClass('vanguard', (options) => new Vanguard(options)),
  promotedClass('sapper', (options) => new Sapper(options)),
  baseClass('scout', 'Scout', (options) => new Scout(options)),
  baseClass('beast', 'Beast', (options) => new Beast(options)),
  baseClass('beast-rider', 'Beast Rider', (options) => new BeastRider(options)),
  baseClass('siege', 'Siege', (options) => new Siege(options)),
  baseClass('ram', 'Ram', (options) => new Ram(options)),
  baseClass('acolyte', 'Acolyte', (options) => new Acolyte(options)),
  promotedClass('mage', (options) => new Mage(options)),
  ...ELEMENTAL_KINDS.map((kind) =>
    Object.freeze<UnitClass>({
      id: elementalClassId(kind),
      label: ELEMENTALS[kind].label,
      create: (options) => new Elemental(kind, options),
      neutral: true,
    }),
  ),
  monsterClass('slime', 'Slime', (options) => new Slime(options)),
  monsterClass('goblin', 'Goblin', (options) => new Goblin(options)),
  monsterClass('skeleton', 'Skeleton', (options) => new Skeleton(options)),
  monsterClass('bat', 'Bat', (options) => new Bat(options)),
  monsterClass('orc', 'Orc', (options) => new Orc(options)),
  Object.freeze<UnitClass>({
    id: 'dragon',
    label: 'Dragon',
    create: (options) => new Dragon(options),
    monster: true,
  }),
]);

// The classes the player can start as, recruit or train: every class but
// the promoted ones, the neutral ones and the monsters.
export const PLAYABLE_CLASSES: readonly UnitClass[] = Object.freeze(
  UNIT_CLASSES.filter((c) => !c.monster && !c.neutral && !c.promotedFrom),
);
// Builds a Unit of the class with the given id. `options` go to the class's
// constructor ({ name, team, level, ... }). Throws on an unknown class.
export function createUnitOfClass(
  classId: string,
  options: ClassUnitOptions,
  classes: readonly UnitClass[] = UNIT_CLASSES,
): Unit {
  const unitClass = classes.find((c) => c.id === classId);
  if (!unitClass) throw new Error(`Unknown unit class: ${classId}`);
  return unitClass.create(options);
}
