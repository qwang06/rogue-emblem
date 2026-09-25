// The starting state of the demo battle: terrain, the enemies already on
// the map, the player's roster (not on the map yet — they're placed during
// deployment), and the deployment zone. Real level data will replace this
// once maps are loaded from data.

import { createGrid, getCornerTiles, setTerrain, setUnit } from './grid.js';
import { Unit } from './Unit.js';

export const DEPLOYMENT_ZONE_SIZE = 3;
export const ENEMY_COUNT = 3;

const soldierStats = { health: 10, attack: 4, defense: 2, movement: 5 };

// Returns { grid, units, roster, deploymentZone }. `units` maps every
// unitId (player and enemy) to its Unit; `roster` lists the player unitIds
// available to deploy; `deploymentZone` is [{ x, y }] of placeable tiles.
export function createDemoLevel(width, height) {
  let grid = createGrid(width, height, 'grass');

  for (let y = 2; y <= 4; y++) {
    for (let x = 5; x <= 7; x++) {
      grid = setTerrain(grid, x, y, 'water');
    }
  }

  const units = new Map([
    ['soldier', new Unit({ name: 'Soldier', ...soldierStats, team: 'player' })],
  ]);

  getCornerTiles(grid, 'bottom-right', ENEMY_COUNT).forEach(({ x, y }, i) => {
    const unitId = `enemy-${i + 1}`;
    units.set(unitId, new Unit({ name: 'Enemy Soldier', ...soldierStats, team: 'enemy' }));
    grid = setUnit(grid, x, y, unitId);
  });

  return {
    grid,
    units,
    roster: ['soldier'],
    deploymentZone: getCornerTiles(grid, 'top-left', DEPLOYMENT_ZONE_SIZE),
  };
}
