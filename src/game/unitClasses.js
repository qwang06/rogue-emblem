// The unit classes the game knows how to build, in menu order. Each entry
// names the class and builds a fresh Unit of it, so menus that offer a
// choice of class (e.g. Training) don't need to know the subclasses.

import { Soldier } from './Soldier.js';
import { Villager } from './Villager.js';

export const UNIT_CLASSES = Object.freeze([
  Object.freeze({ id: 'villager', label: 'Villager', create: (options) => new Villager(options) }),
  Object.freeze({ id: 'soldier', label: 'Soldier', create: (options) => new Soldier(options) }),
]);

// Builds a Unit of the class with the given id. `options` go to the class's
// constructor ({ name, team, level, ... }). Throws on an unknown class.
export function createUnitOfClass(classId, options, classes = UNIT_CLASSES) {
  const unitClass = classes.find((c) => c.id === classId);
  if (!unitClass) throw new Error(`Unknown unit class: ${classId}`);
  return unitClass.create(options);
}
