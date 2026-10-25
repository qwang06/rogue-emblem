// A Warband Mode stage's battle: a procedurally generated map
// (src/game/mapGen.ts) with the player deploying at the south end of the
// path and enemies placed by the region's enemy groups
// (src/game/enemySpawns.ts). The stage's region (regions.ts) sets the map's
// size and makeup; everything else comes from one seed, so a seed and a
// region are enough to rebuild the same battle. A seed lays out several
// candidate maps and keeps the one mapScore.ts grades best of those that
// keep mapCheck.ts's rules.

import { PLAYER_ROSTER, type DemoLevel, type TreePlacement } from '../demoLevel.ts';
import { setUnit, type Point } from '../grid.ts';
import { getBuildingSprites, getFeatureSprites } from '../mapArt.ts';
import { pickZonedEnemyTiles } from '../enemySpawns.ts';
import type { Rng } from '../combatStats.ts';
import { growToLevel } from '../experience.ts';
import { assignLoot } from '../loot.ts';
import type { GeneratedTerrain } from '../mapGen.ts';
import { generateMap } from '../mapPlan.ts';
import { checkMap } from '../mapCheck.ts';
import { getMapMetrics, scoreMap, type MapMetrics } from '../mapScore.ts';
import type { MapArchetype } from '../mapArchetypes.ts';
import { DEFAULT_OBJECTIVE, type ObjectiveKind } from '../objectives.ts';
import { createSeededRng, randomItem } from '../rng.ts';
import type { Unit } from '../Unit.ts';
import { createUnitOfClass, UNIT_CLASSES } from '../unitClasses.ts';
import { BUILDING_ART, BUILDING_PALETTES, FOREST_ART, MOUNTAIN_ART } from '../tileset.ts';
import type { RegionConfig } from './regions.ts';
import { DEFAULT_STARTING_CLASS } from './startingClasses.ts';

export const WARBAND_MAX_DEPLOYED = 5;

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

// Kept here too, where enemy groups first used it.
export { growToLevel };

// The class an enemy group's units are when it doesn't set one.
export const DEFAULT_ENEMY_CLASS = 'soldier';

const key = ({ x, y }: Point) => `${x},${y}`;

// How many candidate maps a stage's seed lays out to keep the best of.
export const MAP_CANDIDATES = 30;

// The seeds a stage's candidates are laid out from: `seed` itself first,
// then `count - 1` more drawn from it.
export function getCandidateSeeds(seed: number, count = MAP_CANDIDATES): number[] {
  const rng = createSeededRng(seed);
  return [seed, ...Array.from({ length: count - 1 }, () => Math.floor(rng() * 2 ** 32))];
}

// One candidate map: the terrain, where each side starts, the rules it
// breaks (see mapCheck.ts), its grade (see mapScore.ts), and the Rng it was
// laid out with, ready for the rest of the level to be built from.
export interface StageLayout {
  seed: number;
  rng: Rng;
  terrain: GeneratedTerrain;
  deploymentZone: Point[];
  // One list of tiles per enemy group in region.enemies.
  enemyTiles: Point[][];
  problems: string[];
  metrics: MapMetrics;
  score: number;
}

// The candidate laid out from `seed`: the terrain from region.terrain, the
// deployment zone where the map's archetype puts it (on the path's south
// end and the tiles either side of it for 'advance'), and the enemies'
// tiles from region.enemies, dealt into the archetype's enemy zones when it
// has them.
export function layOutStage(seed: number, region: RegionConfig): StageLayout {
  const rng = createSeededRng(seed);
  const terrain = generateMap(region.terrain, rng);
  const start = terrain.path[0];
  const baseZone = terrain.deploymentZone ?? [-1, 0, 1].map((dx) => ({ x: start.x + dx, y: start.y }));
  const deploymentZone = [...baseZone];
  const occupied = new Set(baseZone.map(({ x, y }) => `${x},${y}`));
  const candidates = terrain.grid.cells
    .filter(
      ({ x, y, terrain: kind, unitId }) =>
        !occupied.has(`${x},${y}`) && !unitId && kind !== 'water' && kind !== 'mountain' && kind !== 'wall',
    )
    .sort((a, b) => {
      const distance = (tile: Point) =>
        Math.min(...baseZone.map((start) => Math.abs(tile.x - start.x) + Math.abs(tile.y - start.y)));
      return distance(a) - distance(b) || b.y - a.y || a.x - b.x;
    });
  deploymentZone.push(...candidates.slice(0, WARBAND_MAX_DEPLOYED - baseZone.length).map(({ x, y }) => ({ x, y })));
  const enemyTiles = pickZonedEnemyTiles(terrain.grid, region.enemies, deploymentZone, terrain.enemyZones ?? [], rng);
  const problems = checkMap({
    grid: terrain.grid,
    buildings: terrain.buildings,
    deploymentZone,
    enemyTiles: enemyTiles.flat(),
  });
  const metrics = getMapMetrics(terrain.grid, deploymentZone, enemyTiles.flat());
  return { seed, rng, terrain, deploymentZone, enemyTiles, problems, metrics, score: scoreMap(metrics) };
}

// Whether `a` is a better candidate than `b`: one that keeps every rule
// beats one that doesn't, then the lower score wins.
function isBetter(a: StageLayout, b: StageLayout): boolean {
  const aOk = a.problems.length === 0;
  const bOk = b.problems.length === 0;
  return aOk !== bOk ? aOk : a.score < b.score;
}

// The best of `candidates` layouts from `seed`: the best-scoring one that
// keeps every rule (the earliest on a tie, so a map that already meets
// every target is kept as is), or the best-scoring one if none does.
export function pickStageLayout(seed: number, region: RegionConfig, candidates = MAP_CANDIDATES): StageLayout {
  let best: StageLayout | null = null;
  for (const candidate of getCandidateSeeds(seed, candidates)) {
    const layout = layOutStage(candidate, region);
    if (!best || isBetter(layout, best)) best = layout;
    if (best.problems.length === 0 && best.score === 0) break;
  }
  return best!;
}

// Returns a level shaped like createDemoLevel's, generated from `seed` with
// `region`'s terrain options, on the best of the seed's candidate maps (see
// pickStageLayout):
// - deploymentZone: the path's south end and the tiles either side of it
// - roster: `roster`'s units (a run's warband), else createStartingWarband's,
//   deploying up to `maxDeployed`
// - enemies: a unit of its group's class (a soldier when unset) on each tile pickEnemyTiles finds for region.enemies
//   (fewer than asked when a group's limits leave too few tiles), at its
//   group's level (growToLevel), starting on its group's health when it
//   sets one, and levelling its killer up when the group sets
//   levelUpOnKill
// - bossUnitId: the first enemy of the first group that names a boss,
//   renamed to it and holding its ground
// - buildings: the generator's, drawn in region.palette
// - decorations: green ginkgos scattered (region.treeChance) on the grass no
//   other art covers
// - objective: a rout; battleSetup.ts places the stage's own (stageObjective.ts)
// - seizeTile: the tile the map's archetype planned for a seize, if any
// - loot: `lootCount` of the enemies (as many as there are, if fewer) each
//   carry an item to drop (see assignLoot), picked after everything else so
//   the map is the same whatever the count
export function createStageLevel(
  seed: number,
  region: RegionConfig,
  roster: ReadonlyMap<string, Unit> = createStartingWarband(),
  maxDeployed = WARBAND_MAX_DEPLOYED,
  lootCount = 0,
): DemoLevel {
  const layout = pickStageLayout(seed, region);
  const { rng, deploymentZone } = layout;
  const { buildings } = layout.terrain;
  let { grid } = layout.terrain;

  const enemyTiles = layout.enemyTiles.flatMap((tiles, g) =>
    tiles.map((tile) => ({ ...tile, group: region.enemies[g] })),
  );

  const units = new Map(roster);
  let bossUnitId: string | undefined;
  enemyTiles.forEach(({ x, y, group }, i) => {
    const unitId = `enemy-${i + 1}`;
    const classId = group.unitClass ?? DEFAULT_ENEMY_CLASS;
    const label = UNIT_CLASSES.find((c) => c.id === classId)?.label ?? classId;
    const enemy = createUnitOfClass(classId, { name: `Enemy ${label}`, team: 'enemy' });
    growToLevel(enemy, group.level ?? 1);
    if (group.health !== undefined) enemy.health = Math.min(group.health, enemy.maxHealth);
    enemy.levelUpOnKill = group.levelUpOnKill ?? false;
    if (group.boss && !bossUnitId) {
      enemy.name = group.boss;
      enemy.holdsPosition = true;
      bossUnitId = unitId;
    }
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

  const enemyIds = enemyTiles.map((_, i) => `enemy-${i + 1}`);
  for (const [unitId, item] of assignLoot(enemyIds, lootCount, rng)) units.get(unitId)!.loot = item;

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
    objective: DEFAULT_OBJECTIVE,
    ...(layout.terrain.seizeTile ? { seizeTile: { ...layout.terrain.seizeTile } } : {}),
    ...(bossUnitId ? { bossUnitId } : {}),
  };
}

// Which archetypes suit each objective (see mapArchetypes.ts): a seize
// wants a tile worth fighting over, a boss a stronghold, a survive enemies
// closing in from more than one side.
export const OBJECTIVE_ARCHETYPES: Readonly<Record<ObjectiveKind, readonly MapArchetype[]>> = Object.freeze({
  rout: Object.freeze(['advance', 'ambush', 'gauntlet', 'islands'] as const),
  seize: Object.freeze(['crossroads', 'islands', 'fortress'] as const),
  boss: Object.freeze(['fortress', 'advance', 'gauntlet'] as const),
  survive: Object.freeze(['ambush', 'crossroads'] as const),
});

// Mixed into the stage seed so the archetype's draw doesn't follow the
// objective's or the map's.
const ARCHETYPE_SEED_SALT = 0x3a9e7c;

// The archetype stage `stage` (1 is the first) of `region` is laid out
// as, for an `objective` stage, seeded by the stage's `seed`: the region's
// own if it sets one, 'advance' on stage 1, else one of
// OBJECTIVE_ARCHETYPES[objective].
export function pickStageArchetype(
  stage: number,
  region: RegionConfig,
  seed: number,
  objective: ObjectiveKind,
): MapArchetype {
  if (region.terrain.archetype) return region.terrain.archetype;
  if (stage <= 1) return 'advance';
  return randomItem(createSeededRng(seed ^ ARCHETYPE_SEED_SALT), OBJECTIVE_ARCHETYPES[objective]);
}

// `region` with its maps laid out as `archetype`.
export function withArchetype(region: RegionConfig, archetype: MapArchetype): RegionConfig {
  return { ...region, terrain: { ...region.terrain, archetype } };
}
