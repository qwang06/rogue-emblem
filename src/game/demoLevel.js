// The starting state of the demo battle: terrain, the enemies already on
// the map, the player's roster (not on the map yet — they're placed during
// deployment), and the deployment zone. Real level data will replace this
// once maps are loaded from data.

import { setUnit } from './grid.js';
import { Soldier } from './Soldier.js';
import { Villager } from './Villager.js';
import { parseTerrainMap } from './terrainMap.js';

// Level 1: a dirt path runs north up the middle of a grass field to a
// paifang gate, with a stand of gold ginkgos behind the gate and green
// ginkgos scattered across the field. 16x14 tiles. '.' is grass, ',' is
// dirt. Every tile under the gate is walkable: the path through its middle
// and grass under its sides.
export const DEMO_MAP = Object.freeze([
  '................',
  '................',
  '................',
  '........,.......',
  '........,.......',
  '........,.......',
  '........,.......',
  '........,.......',
  '........,.......',
  '........,.......',
  '........,.......',
  '........,.......',
  '........,.......',
  '........,.......',
]);

// Multi-tile structures drawn over the terrain, by top-left tile: the gate
// (3x2 tiles) straddles the north end of the path.
export const STRUCTURE_POSITIONS = Object.freeze([Object.freeze({ x: 7, y: 3, structure: 'gate' })]);

// The player deploys at the south end of the path, and the enemies hold the
// gate: one in its opening and one on either side.
export const DEPLOYMENT_ZONE = Object.freeze([
  { x: 7, y: 13 },
  { x: 8, y: 13 },
  { x: 9, y: 13 },
]);
export const ENEMY_POSITIONS = Object.freeze([
  { x: 8, y: 4 },
  { x: 5, y: 5 },
  { x: 11, y: 6 },
]);

// Trees, as decoration only — they don't block movement. A stand of gold
// ginkgos right behind the gate, and three clumps of green ones in the field: west
// of the gate, in the southwest corner, and in the east.
export const TREE_POSITIONS = Object.freeze(
  [
    { x: 8, y: 1, tree: 'gold_ginkgo' },
    { x: 7, y: 2, tree: 'gold_ginkgo' },
    { x: 8, y: 2, tree: 'gold_ginkgo' },
    { x: 9, y: 2, tree: 'gold_ginkgo' },
    { x: 2, y: 4, tree: 'green_ginkgo' },
    { x: 1, y: 5, tree: 'green_ginkgo' },
    { x: 3, y: 5, tree: 'green_ginkgo' },
    { x: 2, y: 6, tree: 'green_ginkgo' },
    { x: 13, y: 9, tree: 'green_ginkgo' },
    { x: 12, y: 10, tree: 'green_ginkgo' },
    { x: 14, y: 10, tree: 'green_ginkgo' },
    { x: 13, y: 11, tree: 'green_ginkgo' },
    { x: 4, y: 12, tree: 'green_ginkgo' },
    { x: 5, y: 12, tree: 'green_ginkgo' },
    { x: 3, y: 13, tree: 'green_ginkgo' },
    { x: 5, y: 13, tree: 'green_ginkgo' },
  ].map(Object.freeze),
);

// The player's roster of villagers, by unitId -> name. One unit per
// deployment tile.
export const PLAYER_ROSTER = Object.freeze({
  'villager-1': 'Alden',
  'villager-2': 'Bryn',
  'villager-3': 'Cato',
});

// The conversation before deployment, as a script for src/game/dialog.js.
// The roster speaks from the left; the enemy answers from the right.
const [ALDEN, BRYN, CATO] = Object.values(PLAYER_ROSTER);
export const DEMO_OPENING_DIALOG = Object.freeze(
  [
    {
      speaker: ALDEN,
      unitClass: 'villager',
      side: 'left',
      text: 'Enemy soldiers have taken the old gate. This road is the only way through.',
    },
    {
      speaker: BRYN,
      unitClass: 'villager',
      side: 'left',
      text: "Three of them, by my count. They'll see us coming all the way up the road.",
    },
    {
      speaker: 'Enemy Soldier',
      unitClass: 'soldier',
      side: 'right',
      text: 'Hold the line! Nobody passes the gate while we still stand.',
    },
    { speaker: CATO, unitClass: 'villager', side: 'left', text: "Then we won't let them stand for long." },
    { speaker: ALDEN, unitClass: 'villager', side: 'left', text: 'Take your positions. We move on my signal.' },
  ].map(Object.freeze),
);

// Returns { grid, units, roster, deploymentZone, openingDialog, decorations,
// structures }. `units`
// maps every unitId (player and enemy) to its Unit; `roster` lists the
// player unitIds available to deploy; `deploymentZone` is [{ x, y }] of
// placeable tiles; `openingDialog` is the script played before deployment;
// `decorations` is [{ x, y, tree }] of trees drawn over the grass;
// `structures` is [{ x, y, structure }] of multi-tile art by top-left tile.
export function createDemoLevel() {
  let grid = parseTerrainMap(DEMO_MAP);

  const units = new Map(
    Object.entries(PLAYER_ROSTER).map(([unitId, name]) => [unitId, new Villager({ name, team: 'player' })]),
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
    openingDialog: DEMO_OPENING_DIALOG,
    decorations: TREE_POSITIONS.map((tree) => ({ ...tree })),
    structures: STRUCTURE_POSITIONS.map((structure) => ({ ...structure })),
  };
}
