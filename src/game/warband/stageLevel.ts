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
import type { Unit } from '../Unit.ts';
import { createUnitOfClass, UNIT_CLASSES } from '../unitClasses.ts';
import { BUILDING_ART, BUILDING_PALETTES, FOREST_ART, MOUNTAIN_ART } from '../tileset.ts';
import type { RegionConfig } from './regions.ts';
import { DEFAULT_STARTING_CLASS } from './startingClasses.ts';

export const WARBAND_MAX_DEPLOYED = 3;

// The name of the unit a run starts with: the demo roster's first.
export const WARBAND_LEADER_NAME = Object.values(PLAYER_ROSTER)[0];

// The warband a new run starts with (and a region preview fields): a
// single level-1 unit of `classId` (see STARTING_CLASSES) named `name`, by
// unitId `<classId>-1`. Throws on an unknown class.
export function createStartingWarband(
  classId: string = DEFAULT_STARTING_CLASS,
  name: string = WARBAND_LEADER_NAME,
): Map<string, Unit> {
  return new Map([[`${classId}-1`, createUnitOfClass(classId, { name, team: 'player' })]]);
}

// The class an enemy group's units are when it doesn't set one.
export const DEFAULT_ENEMY_CLASS = 'soldier';

const key = ({ x, y }: Point) => `${x},${y}`;

// Returns a level shaped like createDemoLevel's, generated from `seed` with
// `region`'s terrain options:
// - deploymentZone: the path's south end and the tiles either side of it
// - roster: `roster`'s units (a run's warband), else createStartingWarband's,
//   deploying up to `maxDeployed`
// - enemies: a unit of its group's class (a soldier when unset) on each tile pickEnemyTiles finds for region.enemies
//   (fewer than asked when a group's limits leave too few tiles), starting
//   on its group's health when it sets one, and levelling its killer up
//   when the group sets levelUpOnKill
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

  const enemyTiles = pickEnemyTiles(grid, region.enemies, deploymentZone, rng).flatMap((tiles, g) =>
    tiles.map((tile) => ({ ...tile, group: region.enemies[g] })),
  );

  const units = new Map(roster);
  enemyTiles.forEach(({ x, y, group }, i) => {
    const unitId = `enemy-${i + 1}`;
    const classId = group.unitClass ?? DEFAULT_ENEMY_CLASS;
    const label = UNIT_CLASSES.find((c) => c.id === classId)?.label ?? classId;
    const enemy = createUnitOfClass(classId, { name: `Enemy ${label}`, team: 'enemy' });
    if (group.health !== undefined) enemy.health = Math.min(group.health, enemy.maxHealth);
    enemy.levelUpOnKill = group.levelUpOnKill ?? false;
    units.set(unitId, enemy);
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
