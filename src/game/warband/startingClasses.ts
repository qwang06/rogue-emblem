// The base classes a new Warband Mode run can start with. The player picks
// one, and the run's starting warband is made of that class (see
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
    id: 'villager',
    label: 'Villager',
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

export const DEFAULT_STARTING_CLASS = 'villager';
