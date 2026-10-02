// A tiny practice battle: the unit class the player picked from the
// Training menu faces a single sparring partner of the same class on a
// small open field. There's no deployment — both units start on the map.

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

// The sparring partner's greeting before the bout, as a script for
// src/game/dialog.js. The partner is of the trainee's class, so its
// portrait art is too.
export function getTrainingOpeningDialog(unitClass) {
  return Object.freeze(
    [
      {
        speaker: 'Sparring Partner',
        unitClass,
        side: 'right',
        text: "Ready when you are. Don't hold back on my account.",
      },
      {
        speaker: 'Sparring Partner',
        unitClass,
        side: 'right',
        text: 'Move in close, pick your action, and show me what you can do.',
      },
    ].map(Object.freeze),
  );
}

// Returns { grid, units, roster, deploymentZone, openingDialog } like
// createDemoLevel, with both units already placed and nothing to deploy
// (empty roster and zone).
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
    openingDialog: getTrainingOpeningDialog(unitClass),
  };
}
