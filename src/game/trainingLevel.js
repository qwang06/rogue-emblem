// A tiny practice battle: the unit class the player picked from the
// Training menu faces a single sparring partner of the same class on a
// small open field. There's no deployment — both units start on the map.

import { DIALOGS } from '../data/dialogs.js';
import { setUnit } from './grid.js';
import { parseTerrainMap } from './terrainMap.js';
import { createUnitOfClass, UNIT_CLASSES } from './unitClasses.js';

// Open grass, '.' per tile.
export const TRAINING_MAP = Object.freeze(['...', '...', '...']);

// The trainee starts on the west edge, the sparring partner on the east.
export const TRAINEE_POSITION = Object.freeze({ x: 0, y: 1 });
export const SPARRING_PARTNER_POSITION = Object.freeze({ x: 2, y: 1 });

export const TRAINEE_ID = 'trainee';
export const SPARRING_PARTNER_ID = 'sparring-partner';

// Entries for the Training menu: one per unit class, as { id, label } with
// the class id, for the actionMenu.js helpers.
export function getTrainingActions(classes = UNIT_CLASSES) {
  return Object.freeze(classes.map(({ id, label }) => Object.freeze({ id, label })));
}

// Training's conversations by trigger, from src/data/dialog/training.txt,
// with every line given `unitClass` for its stand-in art: the sparring
// partner is of the trainee's class, so its portrait is too.
export function getTrainingDialogs(unitClass, dialogs = DIALOGS.training) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(dialogs).map(([trigger, lines]) => [
        trigger,
        Object.freeze(lines.map((line) => Object.freeze({ ...line, unitClass }))),
      ]),
    ),
  );
}

// Returns { grid, units, roster, deploymentZone, dialogs } like
// createDemoLevel, with both units already placed and nothing to deploy
// (empty roster and zone). `dialogs` come from getTrainingDialogs.
// Throws on an unknown unit class.
export function createTrainingLevel(unitClass) {
  const trainee = createUnitOfClass(unitClass, { team: 'player' });
  const partner = createUnitOfClass(unitClass, { name: 'Sparring Partner', team: 'enemy' });

  let grid = parseTerrainMap(TRAINING_MAP);
  grid = setUnit(grid, TRAINEE_POSITION.x, TRAINEE_POSITION.y, TRAINEE_ID);
  grid = setUnit(grid, SPARRING_PARTNER_POSITION.x, SPARRING_PARTNER_POSITION.y, SPARRING_PARTNER_ID);

  return {
    grid,
    units: new Map([
      [TRAINEE_ID, trainee],
      [SPARRING_PARTNER_ID, partner],
    ]),
    roster: [],
    deploymentZone: [],
    dialogs: getTrainingDialogs(unitClass),
  };
}
