// The base classes a new Warband Mode run can start with, before renown
// unlocks more (UNLOCKABLE_STARTING_CLASSES). The player picks one, and
// the run's starting warband is made of that class (see
// createStartingWarband). Each entry carries a one-line pitch for the
// menu, so the trade-off is visible when choosing.

export interface StartingClass {
  // One of UNIT_CLASSES' ids.
  id: string;
  label: string;
  description: string;
}

export const STARTING_CLASSES: readonly StartingClass[] = Object.freeze([
  Object.freeze({
    id: 'warrior',
    label: 'Warrior',
    description: 'Weakest at the start, but learns fastest and grows into the strongest unit of all.',
  }),
  Object.freeze({
    id: 'soldier',
    label: 'Soldier',
    description: 'Sturdy spear infantry, solid from the first battle.',
  }),
  Object.freeze({
    id: 'archer',
    label: 'Archer',
    description: 'Accurate and quick, strikes from two tiles away but is frail up close.',
  }),
]);

export const DEFAULT_STARTING_CLASS = 'warrior';

// The classes renown unlocks as starting classes (see meta.ts's UNLOCKS),
// in the order they unlock. Each must still win stage 1 alone, so the
// Acolyte, too frail to, isn't one.
export const UNLOCKABLE_STARTING_CLASSES: readonly StartingClass[] = Object.freeze([
  Object.freeze({
    id: 'vanguard',
    label: 'Vanguard',
    description: 'Hits hardest with an axe and soaks blows, but slow and easy to hit.',
  }),
  Object.freeze({
    id: 'guard',
    label: 'Guard',
    description: 'Heavily armored spear wall that shrugs off hits, but moves a tile less.',
  }),
]);

// Every class a run can ever start as: the base ones, then the unlockable ones.
export const ALL_STARTING_CLASSES: readonly StartingClass[] = Object.freeze([
  ...STARTING_CLASSES,
  ...UNLOCKABLE_STARTING_CLASSES,
]);
