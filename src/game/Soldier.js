import { STARTING_ITEMS } from './items.js';
import { Unit } from './Unit.js';

export const SOLDIER_STATS = Object.freeze({
  health: 10,
  mana: 5,
  strength: 4,
  magic: 0,
  skill: 3,
  speed: 3,
  luck: 2,
  defense: 2,
  resistance: 0,
  movement: 5,
});

// Percent chance per level up that each stat rises (see experience.js).
export const SOLDIER_GROWTHS = Object.freeze({
  health: 70,
  mana: 40,
  strength: 45,
  magic: 5,
  skill: 40,
  speed: 40,
  luck: 30,
  defense: 30,
  resistance: 15,
});

// The most each stat can reach through level ups.
export const SOLDIER_CAPS = Object.freeze({
  health: 40,
  mana: 30,
  strength: 20,
  magic: 20,
  skill: 20,
  speed: 20,
  luck: 20,
  defense: 20,
  resistance: 20,
});

// The basic infantry unit. Starts at level 1 with the soldier stat line;
// its skills come from the 'soldier' skill tree, and it carries the
// starting items (a health and a mana potion) unless given others. Levels
// up with the soldier growth rates and caps.
export class Soldier extends Unit {
  constructor({ name = 'Soldier', team, level = 1, items = STARTING_ITEMS }) {
    super({
      name,
      unitClass: 'soldier',
      level,
      team,
      items,
      growths: SOLDIER_GROWTHS,
      caps: SOLDIER_CAPS,
      ...SOLDIER_STATS,
    });
  }
}
