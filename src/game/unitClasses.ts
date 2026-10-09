// The unit classes the game knows how to build, in menu order. Each entry
// names the class and builds a fresh Unit of it, so menus that offer a
// choice of class (e.g. Training) don't need to know the subclasses.

import { Archer } from './Archer.ts';
import { Soldier } from './Soldier.ts';
import type { ClassUnitOptions, Unit } from './Unit.ts';
import { Vanguard } from './Vanguard.ts';
import { Villager } from './Villager.ts';
import { Wizard } from './Wizard.ts';

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
  Object.freeze<UnitClass>({ id: 'wizard', label: 'Wizard', create: (options) => new Wizard(options) }),
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
