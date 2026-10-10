// The unit classes the game knows how to build, in menu order. Each entry
// names the class and builds a fresh Unit of it, so menus that offer a
// choice of class (e.g. Training) don't need to know the subclasses. The
// monsters (slime, goblin, skeleton) come last: they're enemies in Warband
// Mode, never recruits or starting picks.

import { Acolyte } from './Acolyte.ts';
import { Archer } from './Archer.ts';
import { Goblin } from './Goblin.ts';
import { Guard } from './Guard.ts';
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
}

export const UNIT_CLASSES: readonly UnitClass[] = Object.freeze([
  Object.freeze<UnitClass>({ id: 'villager', label: 'Villager', create: (options) => new Villager(options) }),
  Object.freeze<UnitClass>({ id: 'soldier', label: 'Soldier', create: (options) => new Soldier(options) }),
  Object.freeze<UnitClass>({ id: 'archer', label: 'Archer', create: (options) => new Archer(options) }),
  Object.freeze<UnitClass>({ id: 'vanguard', label: 'Vanguard', create: (options) => new Vanguard(options) }),
  Object.freeze<UnitClass>({ id: 'guard', label: 'Guard', create: (options) => new Guard(options) }),
  Object.freeze<UnitClass>({ id: 'acolyte', label: 'Acolyte', create: (options) => new Acolyte(options) }),
  Object.freeze<UnitClass>({ id: 'slime', label: 'Slime', create: (options) => new Slime(options) }),
  Object.freeze<UnitClass>({ id: 'goblin', label: 'Goblin', create: (options) => new Goblin(options) }),
  Object.freeze<UnitClass>({ id: 'skeleton', label: 'Skeleton', create: (options) => new Skeleton(options) }),
]);

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
