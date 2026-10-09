// A Warband Mode stage's battle: a procedurally generated map
// (src/game/mapGen.ts) with the player deploying at the south end of the
// path and enemies placed by the region's enemy groups
// (src/game/enemySpawns.ts). The stage's region (regions.ts) sets the map's
// size and makeup; everything else comes from one seed, so a seed and a
// region are enough to rebuild the same battle.

import { PLAYER_ROSTER, type DemoLevel, type TreePlacement } from '../demoLevel.ts';
import { setUnit, type Point } from '../grid.ts';
import { getBuildingSprites, getFeatureSprites } from '../mapArt.ts';
import { pickEnemyTiles } from '../enemySpawns.ts';
import { generateTerrain } from '../mapGen.ts';
import { DEFAULT_OBJECTIVE } from '../objectives.ts';
import { createSeededRng } from '../rng.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { BUILDING_ART, BUILDING_PALETTES, FOREST_ART, MOUNTAIN_ART } from '../tileset.ts';
import { Villager } from '../Villager.ts';
import type { RegionConfig } from './regions.ts';

export const WARBAND_MAX_DEPLOYED = 3;

// The warband a new run starts with (and a region preview fields): the
// demo's villagers, by unitId.
export function createStartingWarband(): Map<string, Unit> {
  return new Map(
    Object.entries(PLAYER_ROSTER).map(([unitId, name]) => [unitId, new Villager({ name, team: 'player' })]),
  );
}

const key = ({ x, y }: Point) => `${x},${y}`;

// Returns a level shaped like createDemoLevel's, generated from `seed` with
// `region`'s terrain options:
// - deploymentZone: the path's south end and the tiles either side of it
// - roster: `roster`'s units (a run's warband), else createStartingWarband's,
//   deploying up to `maxDeployed`
// - enemies: a soldier on each tile pickEnemyTiles finds for region.enemies
//   (fewer than asked when a group's limits leave too few tiles)
// - buildings: the generator's, drawn in region.palette
// - decorations: green ginkgos scattered (region.treeChance) on the grass no
//   other art covers
// - objective: region.objective, else a rout (defeat all enemies)
export function createStageLevel(
  seed: number,
  region: RegionConfig,
  roster: ReadonlyMap<string, Unit> = createStartingWarband(),
  maxDeployed = WARBAND_MAX_DEPLOYED,
): DemoLevel {
  const rng = createSeededRng(seed);
  const generated = generateTerrain(region.terrain, rng);
  const { path, buildings } = generated;
  let { grid } = generated;

  const start = path[0];
  const deploymentZone = [-1, 0, 1].map((dx) => ({ x: start.x + dx, y: start.y }));

  const enemyTiles = pickEnemyTiles(grid, region.enemies, deploymentZone, rng).flat();

  const units = new Map(roster);
  enemyTiles.forEach(({ x, y }, i) => {
    const unitId = `enemy-${i + 1}`;
    units.set(unitId, new Soldier({ name: 'Enemy Soldier', team: 'enemy' }));
    grid = setUnit(grid, x, y, unitId);
  });

  // Tiles a tree would clash with: the deployment zone, and any tile a
  // building, its overhang, or a mountain's peak is drawn on.
  const covered = new Set([
    ...deploymentZone.map(key),
    ...getBuildingSprites(buildings, BUILDING_PALETTES[region.palette], BUILDING_ART).map(key),
    ...getFeatureSprites(grid, FOREST_ART, MOUNTAIN_ART).map(key),
  ]);
  const decorations: TreePlacement[] = grid.cells
    .filter((c) => c.terrain === 'grass' && !c.unitId && !covered.has(key(c)))
    .filter(() => rng() < region.treeChance)
    .map(({ x, y }) => ({ x, y, tree: 'green_ginkgo' }));

  return {
    grid,
    units,
    roster: [...roster.keys()],
    deploymentZone,
    maxDeployed,
    dialogs: {},
    decorations,
    structures: [],
    buildings,
    palette: region.palette,
    objective: region.objective ?? DEFAULT_OBJECTIVE,
  };
}
