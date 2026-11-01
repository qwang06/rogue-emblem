// Warband Mode's regions. A run fights stage after stage (1, 2, 3, ...);
// every `stagesPerRegion` stages (or, without it, spread evenly up to the
// final stage) it moves on to the next region, which sets
// those stages' map size, how much of each terrain the generator grows,
// where the enemies stand and how the buildings are colored. Past the last
// region, every stage uses the last one. The built-in regions are data, in
// src/data/regions.json (loaded by src/data/regions.ts); this module holds
// their shape and the rules for picking a stage's region.

import type { FactionId } from '../factions.ts';
import type { EnemyGroup } from '../enemySpawns.ts';
import type { MapGenOptions } from '../mapGen.ts';
import type { ObjectiveSpec } from '../objectives.ts';
import type { BuildingPaletteName, Season } from '../tileset.ts';
import type { RegionBiome } from './realm/realmRegions.ts';

export interface RegionConfig {
  // The region's name, e.g. for a stage banner ("Stage 3: Highlands").
  name: string;
  // What the region is like, for whoever edits the configs.
  description?: string;
  // The generator's options, map size included (see mapGen.ts).
  terrain: MapGenOptions;
  // The enemies, in groups that each say their class and where they may stand (see
  // enemySpawns.ts).
  enemies: readonly EnemyGroup[];
  // Chance (0–1) each free grass tile gets a decorative tree.
  treeChance: number;
  // The building and wall colors.
  palette: BuildingPaletteName;
  // The faction its enemies fight for (factions.ts), whose version of
  // their classes' art they wear; DEFAULT_ENEMY_FACTION when unset.
  faction?: FactionId;
  // The objective every stage in the region plays (placed on each map by
  // stageObjective.ts); if unset, each stage draws its own.
  objective?: ObjectiveSpec;
  // The land the region's battles are set in, which realm sites on that
  // land prefer to play (see realm/realmRegions.ts); any site may play a
  // region without one.
  biome?: RegionBiome;
  // The season its maps are drawn in (SEASON_TERRAIN_SHEETS in tileset.ts):
  // summer's green grass when unset, or autumn's or winter's sheet.
  season?: Season;
}

// Everything Warband Mode reads per stage: the regions in order and how
// many stages each lasts. This is the shape of src/data/regions.json and
// of the files the config editor takes (see regionsFile.ts).
export interface RegionSettings {
  // How many stages each region lasts. Unset, the regions are spread
  // evenly over the run instead: all but the last share the stages before
  // `finalStage`, and the last plays the final stage (getRegionStages).
  stagesPerRegion?: number;
  regions: readonly RegionConfig[];
  // The stage whose win wins the run; a run never ends in victory when
  // unset.
  finalStage?: number;
  // Regions kept in the file but out of the run: no stage plays them, and
  // nothing reads them yet besides the parser and the config editor's file.
  // Somewhere to keep a region that's still being built (e.g. Starship).
  parkedRegions?: readonly RegionConfig[];
}

// What the stages regions cover depends on: the settings, with only the
// regions' count needed.
export type RegionSpanSettings = Pick<RegionSettings, 'stagesPerRegion' | 'finalStage'> & {
  regions: { length: number };
};

// The region for stage `stage` from `settings`: the one whose stages
// (getRegionStages) hold it, the last one past them all.
export function getStageRegion(stage: number, settings: RegionSettings): RegionConfig {
  if (!Number.isInteger(stage) || stage < 1) throw new Error(`Stages start at 1, got ${stage}`);
  if (settings.regions.length === 0) throw new Error('No regions to pick from');
  return settings.regions[getStageRegionIndex(stage, settings)];
}

// The index of the region stage `stage` plays in (see getStageRegion).
export function getStageRegionIndex(stage: number, settings: RegionSpanSettings): number {
  const count = settings.regions.length;
  for (let index = 0; index < count - 1; index++) {
    const { last } = getRegionStages(index, settings);
    if (last !== null && Math.max(1, stage) <= last) return index;
  }
  return Math.max(0, count - 1);
}

// The stages region `index` covers: { first, last }, with last null for
// the last region, which every stage past the others uses. With
// `stagesPerRegion`, each region lasts that many stages in turn; without
// it, the stages before `finalStage` are shared out as evenly as they go
// among all but the last region, and the last one starts on the final
// stage. Without either,
// each region lasts one stage.
export function getRegionStages(index: number, settings: RegionSpanSettings): { first: number; last: number | null } {
  const count = settings.regions.length;
  const isLast = index === count - 1;
  const { stagesPerRegion, finalStage } = settings;
  if (stagesPerRegion === undefined && finalStage !== undefined && count > 1 && finalStage > count - 1) {
    const before = finalStage - 1;
    const start = (i: number) => 1 + Math.floor((i * before) / (count - 1));
    return isLast ? { first: finalStage, last: null } : { first: start(index), last: start(index + 1) - 1 };
  }
  const per = stagesPerRegion ?? 1;
  const first = index * per + 1;
  return { first, last: isLast ? null : first + per - 1 };
}
