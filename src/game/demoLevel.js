// The starting state of the demo battle: terrain, the enemies already on
// the map, the player's roster (not on the map yet — they're placed during
// deployment), and the deployment zone. Real level data will replace this
// once maps are loaded from data.

import { setUnit } from './grid.js';
import { Soldier } from './Soldier.js';
import { parseTerrainMap } from './terrainMap.js';

// A small island on the left joined by a bridge to a large island on the
// right, which has arms reaching north and south. 20x15 tiles. '.' is
// grass, '~' is water.
export const DEMO_MAP = Object.freeze([
  '~~~~~~~~~~~~~....~~~',
  '~~~~~~~~~~~~~....~~~',
  '~~~~~~~~~~~~~....~~~',
  '~~~~~~~~~...........',
  '~~~~~~~~~...........',
  '~.....~~~...........',
  '~.....~~~...........',
  '~...................',
  '~...................',
  '~.....~~~...........',
  '~.....~~~...........',
  '~~~~~~~~~...........',
  '~~~~~~~~~...........',
  '~~~~~~~~~~~~~....~~~',
  '~~~~~~~~~~~~~....~~~',
]);

// Placeholder spots until units get their own placement data: the player
// deploys along the west edge of the small island, and the enemies wait on
// the large island.
export const DEPLOYMENT_ZONE = Object.freeze([
  { x: 1, y: 6 },
  { x: 1, y: 7 },
  { x: 1, y: 8 },
]);
export const ENEMY_POSITIONS = Object.freeze([
  { x: 14, y: 2 },
  { x: 18, y: 6 },
  { x: 18, y: 11 },
]);

// The player's roster, by unitId -> name. One unit per deployment tile.
export const PLAYER_ROSTER = Object.freeze({
  'soldier-1': 'Alden',
  'soldier-2': 'Bryn',
  'soldier-3': 'Cato',
});

// Returns { grid, units, roster, deploymentZone }. `units` maps every
// unitId (player and enemy) to its Unit; `roster` lists the player unitIds
// available to deploy; `deploymentZone` is [{ x, y }] of placeable tiles.
export function createDemoLevel() {
  let grid = parseTerrainMap(DEMO_MAP);

  const units = new Map(
    Object.entries(PLAYER_ROSTER).map(([unitId, name]) => [unitId, new Soldier({ name, team: 'player' })]),
  );

  ENEMY_POSITIONS.forEach(({ x, y }, i) => {
    const unitId = `enemy-${i + 1}`;
    units.set(unitId, new Soldier({ name: 'Enemy Soldier', team: 'enemy' }));
    grid = setUnit(grid, x, y, unitId);
  });

  return {
    grid,
    units,
    roster: Object.keys(PLAYER_ROSTER),
    deploymentZone: DEPLOYMENT_ZONE.map((tile) => ({ ...tile })),
  };
}
