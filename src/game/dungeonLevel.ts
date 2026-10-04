// Dungeon Mode's battle: a procedurally generated map (src/game/mapGen.ts)
// with the player deploying at the south end of the path and enemies placed
// in the north third. The floor's config (src/game/dungeonConfigs.ts) sets
// the map's size and makeup; everything else comes from one seed, so a seed
// and a config are enough to rebuild the same battle.

import { PLAYER_ROSTER, type DemoLevel, type TreePlacement } from './demoLevel.ts';
import { setUnit, type Point } from './grid.ts';
import { getBuildingSprites, getFeatureSprites } from './mapArt.ts';
import { DUNGEON_CONFIGS, type DungeonConfig } from './dungeonConfigs.ts';
import { generateTerrain, getReachable } from './mapGen.ts';
import { DEFAULT_OBJECTIVE } from './objectives.ts';
import { createSeededRng, shuffle } from './rng.ts';
import { Soldier } from './Soldier.ts';
import { BUILDING_ART, BUILDING_PALETTES, FOREST_ART, MOUNTAIN_ART } from './tileset.ts';
import { Villager } from './Villager.ts';

export const DUNGEON_MAX_DEPLOYED = 3;

const key = ({ x, y }: Point) => `${x},${y}`;

// Returns a level shaped like createDemoLevel's, generated from `seed` with
// `config`'s terrain options (the first floor's config by default):
// - deploymentZone: the path's south end and the tiles either side of it
// - enemies: config.enemyCount soldiers on random walkable tiles in the
//   north third that the deployment zone can reach
// - buildings: the generator's, drawn in config.palette
// - decorations: green ginkgos scattered (config.treeChance) on the grass no
//   other art covers
// - objective: config.objective, else a rout (defeat all enemies)
export function createDungeonLevel(seed: number, config: DungeonConfig = DUNGEON_CONFIGS[0]): DemoLevel {
  const rng = createSeededRng(seed);
  const { height } = config.terrain;
  const generated = generateTerrain(config.terrain, rng);
  const { path, buildings } = generated;
  let { grid } = generated;

  const start = path[0];
  const deploymentZone = [-1, 0, 1].map((dx) => ({ x: start.x + dx, y: start.y }));

  const reachable = getReachable(grid, start);
  const enemyCandidates = grid.cells.filter((c) => c.y < Math.floor(height / 3) && reachable.has(key(c)));
  const enemyTiles = shuffle(rng, enemyCandidates).slice(0, config.enemyCount);

  const units = new Map(
    Object.entries(PLAYER_ROSTER).map(([unitId, name]) => [unitId, new Villager({ name, team: 'player' })]),
  );
  enemyTiles.forEach(({ x, y }, i) => {
    const unitId = `enemy-${i + 1}`;
    units.set(unitId, new Soldier({ name: 'Enemy Soldier', team: 'enemy' }));
    grid = setUnit(grid, x, y, unitId);
  });

  // Tiles a tree would clash with: the deployment zone, and any tile a
  // building, its overhang, or a mountain's peak is drawn on.
  const covered = new Set([
    ...deploymentZone.map(key),
    ...getBuildingSprites(buildings, BUILDING_PALETTES[config.palette], BUILDING_ART).map(key),
    ...getFeatureSprites(grid, FOREST_ART, MOUNTAIN_ART).map(key),
  ]);
  const decorations: TreePlacement[] = grid.cells
    .filter((c) => c.terrain === 'grass' && !c.unitId && !covered.has(key(c)))
    .filter(() => rng() < config.treeChance)
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
    buildings,
    palette: config.palette,
    objective: config.objective ?? DEFAULT_OBJECTIVE,
  };
}

// A fresh random seed for a new dungeon battle.
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}
