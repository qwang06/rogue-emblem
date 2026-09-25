// The starting state of the demo battle: terrain, the enemies already on
// the map, the player's roster (not on the map yet — they're placed during
// deployment), and the deployment zone. Real level data will replace this
// once maps are loaded from data.

import { createGrid, getCornerTiles, setTerrain, setUnit } from './grid.js';
import { Soldier } from './Soldier.js';

export const DEPLOYMENT_ZONE_SIZE = 3;
export const ENEMY_COUNT = 3;
// The player's roster, by unitId -> name. One unit per deployment tile.
export const PLAYER_ROSTER = Object.freeze({
  'soldier-1': 'Alden',
  'soldier-2': 'Bryn',
  'soldier-3': 'Cato',
});

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

  const units = new Map(
    Object.entries(PLAYER_ROSTER).map(([unitId, name]) => [unitId, new Soldier({ name, team: 'player' })]),
  );

  getCornerTiles(grid, 'bottom-right', ENEMY_COUNT).forEach(({ x, y }, i) => {
    const unitId = `enemy-${i + 1}`;
    units.set(unitId, new Soldier({ name: 'Enemy Soldier', team: 'enemy' }));
    grid = setUnit(grid, x, y, unitId);
  });

  return {
    grid,
    units,
    roster: Object.keys(PLAYER_ROSTER),
    deploymentZone: getCornerTiles(grid, 'top-left', DEPLOYMENT_ZONE_SIZE),
  };
}
