// Dungeon Mode's battle: a procedurally generated map (src/game/mapGen.ts)
// with the player deploying at the south end of the path and enemies placed
// in the north third. Everything comes from one seed, so a seed is enough to
// rebuild the same battle.

import { PLAYER_ROSTER, type DemoLevel, type TreePlacement } from './demoLevel.ts';
import { setUnit, type Point } from './grid.ts';
import { generateTerrain, getReachable, type MapGenOptions } from './mapGen.ts';
import { createSeededRng, shuffle } from './rng.ts';
import { Soldier } from './Soldier.ts';
import { Villager } from './Villager.ts';

export const DUNGEON_MAP_SIZE: Readonly<Pick<MapGenOptions, 'width' | 'height'>> = Object.freeze({
  width: 16,
  height: 14,
});

export const DUNGEON_ENEMY_COUNT = 3;
export const DUNGEON_MAX_DEPLOYED = 3;
// Chance (0–1) each free grass tile gets a decorative tree.
export const DUNGEON_TREE_CHANCE = 0.1;

const key = ({ x, y }: Point) => `${x},${y}`;

// Returns a level shaped like createDemoLevel's, generated from `seed`:
// - deploymentZone: the path's south end and the tiles either side of it
// - enemies: DUNGEON_ENEMY_COUNT soldiers on random walkable tiles in the
//   north third that the deployment zone can reach
// - decorations: green ginkgos scattered on the remaining grass
export function createDungeonLevel(seed: number): DemoLevel {
  const rng = createSeededRng(seed);
  const { width, height } = DUNGEON_MAP_SIZE;
  let { grid, path } = generateTerrain({ width, height }, rng);

  const start = path[0];
  const deploymentZone = [-1, 0, 1].map((dx) => ({ x: start.x + dx, y: start.y }));

  const reachable = getReachable(grid, start);
  const enemyCandidates = grid.cells.filter((c) => c.y < Math.floor(height / 3) && reachable.has(key(c)));
  const enemyTiles = shuffle(rng, enemyCandidates).slice(0, DUNGEON_ENEMY_COUNT);

  const units = new Map(
    Object.entries(PLAYER_ROSTER).map(([unitId, name]) => [unitId, new Villager({ name, team: 'player' })]),
  );
  enemyTiles.forEach(({ x, y }, i) => {
    const unitId = `enemy-${i + 1}`;
    units.set(unitId, new Soldier({ name: 'Enemy Soldier', team: 'enemy' }));
    grid = setUnit(grid, x, y, unitId);
  });

  const deploymentKeys = new Set(deploymentZone.map(key));
  const decorations: TreePlacement[] = grid.cells
    .filter((c) => c.terrain === 'grass' && !c.unitId && !deploymentKeys.has(key(c)))
    .filter(() => rng() < DUNGEON_TREE_CHANCE)
    .map(({ x, y }) => ({ x, y, tree: 'green_ginkgo' }));

  return {
    grid,
    units,
    roster: Object.keys(PLAYER_ROSTER),
    deploymentZone,
    maxDeployed: DUNGEON_MAX_DEPLOYED,
    dialogs: {},
    decorations,
    structures: [],
  };
}

// A fresh random seed for a new dungeon battle.
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}
