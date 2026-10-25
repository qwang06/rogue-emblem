// The unit classes the game knows how to build, in menu order. Each entry
// names the class and builds a fresh Unit of it, so menus that offer a
// choice of class (e.g. Training) don't need to know the subclasses. The
// base classes come first, then the promoted classes (promotions.ts),
// which a unit only becomes by promoting, then the monsters (slime,
// goblin, skeleton, bat, wolf, orc), which are enemies only. Neither of
// the last two are recruits, starting picks or Training choices (see
// PLAYABLE_CLASSES).

import { Acolyte } from './Acolyte.ts';
import { Archer } from './Archer.ts';
import { Bat } from './Bat.ts';
import { Goblin } from './Goblin.ts';
import { Guard } from './Guard.ts';
import { Orc } from './Orc.ts';
import { Skeleton } from './Skeleton.ts';
import { Slime } from './Slime.ts';
import { Soldier } from './Soldier.ts';
import { PROMOTIONS, promoteUnit } from './promotions.ts';
import type { ClassUnitOptions, Unit } from './Unit.ts';
import { Vanguard } from './Vanguard.ts';
import { Warrior } from './Warrior.ts';
import { Wolf } from './Wolf.ts';

export interface UnitClass {
  id: string;
  label: string;
  create: (options: ClassUnitOptions) => Unit;
  // True for an enemy-only class the player can't field.
  monster?: boolean;
  // The base class a promoted class promotes from (see promotions.ts).
  promotedFrom?: string;
}

const BASE_CLASSES: readonly UnitClass[] = [
  Object.freeze<UnitClass>({ id: 'warrior', label: 'Warrior', create: (options) => new Warrior(options) }),
  Object.freeze<UnitClass>({ id: 'soldier', label: 'Soldier', create: (options) => new Soldier(options) }),
  Object.freeze<UnitClass>({ id: 'archer', label: 'Archer', create: (options) => new Archer(options) }),
  Object.freeze<UnitClass>({ id: 'vanguard', label: 'Vanguard', create: (options) => new Vanguard(options) }),
  Object.freeze<UnitClass>({ id: 'guard', label: 'Guard', create: (options) => new Guard(options) }),
  Object.freeze<UnitClass>({ id: 'acolyte', label: 'Acolyte', create: (options) => new Acolyte(options) }),
];

// A promoted class builds a unit of its base class and promotes it, so a
// fresh one has the base class's level-1 stats plus the promotion's
// bonuses, and its items.
const PROMOTED_CLASSES: readonly UnitClass[] = PROMOTIONS.map((promotion) => {
  const base = BASE_CLASSES.find((unitClass) => unitClass.id === promotion.from)!;
  return Object.freeze<UnitClass>({
    id: promotion.id,
    label: promotion.label,
    create: (options) => promoteUnit(base.create(options), promotion),
    promotedFrom: promotion.from,
  });
});

export const UNIT_CLASSES: readonly UnitClass[] = Object.freeze([
  ...BASE_CLASSES,
  ...PROMOTED_CLASSES,
  Object.freeze<UnitClass>({ id: 'slime', label: 'Slime', create: (options) => new Slime(options), monster: true }),
  Object.freeze<UnitClass>({ id: 'goblin', label: 'Goblin', create: (options) => new Goblin(options), monster: true }),
  Object.freeze<UnitClass>({
    id: 'skeleton',
    label: 'Skeleton',
    create: (options) => new Skeleton(options),
    monster: true,
  }),
  Object.freeze<UnitClass>({ id: 'bat', label: 'Bat', create: (options) => new Bat(options), monster: true }),
  Object.freeze<UnitClass>({ id: 'wolf', label: 'Wolf', create: (options) => new Wolf(options), monster: true }),
  Object.freeze<UnitClass>({ id: 'orc', label: 'Orc', create: (options) => new Orc(options), monster: true }),
]);

// The classes the player can start as, recruit or train: every class but
// the promoted ones and the monsters. Drop the monster filter to make
// monsters playable again.
export const PLAYABLE_CLASSES: readonly UnitClass[] = Object.freeze(
  UNIT_CLASSES.filter((c) => !c.monster && !c.promotedFrom),
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
