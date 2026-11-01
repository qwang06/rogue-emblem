// The classes a new Warband Mode run can start with. The villager is the
// starting unit of the class tree (it promotes into the rest, see
// promotions.ts), so it's the only one; renown unlocks bands with more
// (origins.ts). Each entry carries a one-line pitch for the menu.

export interface StartingClass {
  // One of UNIT_CLASSES' ids.
  id: string;
  label: string;
  description: string;
}

export const STARTING_CLASSES: readonly StartingClass[] = Object.freeze([
  Object.freeze({
    id: 'villager',
    label: 'Villager',
    description:
      'Weakest at the start, but learns fastest and becomes an Archer, Soldier, Vanguard or Sapper at level 5.',
  }),
]);

export const DEFAULT_STARTING_CLASS = 'villager';

// Every class a run can ever start as.
export const ALL_STARTING_CLASSES: readonly StartingClass[] = STARTING_CLASSES;
