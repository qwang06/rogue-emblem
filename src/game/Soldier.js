import { STARTING_ITEMS } from './items.js';
import { Unit } from './Unit.js';

export const SOLDIER_STATS = Object.freeze({
  health: 10,
  mana: 5,
  attack: 4,
  defense: 2,
  movement: 5,
});

// The basic infantry unit. Starts at level 1 with the soldier stat line;
// its skills come from the 'soldier' skill tree, and it carries the
// starting items (a health and a mana potion) unless given others.
export class Soldier extends Unit {
  constructor({ name = 'Soldier', team, level = 1, items = STARTING_ITEMS }) {
    super({ name, unitClass: 'soldier', level, team, items, ...SOLDIER_STATS });
  }
}
