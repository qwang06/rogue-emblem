// Warband Mode's regions. A run fights stage after stage (1, 2, 3, ...);
// every `stagesPerRegion` stages it moves on to the next region, which sets
// those stages' map size, how much of each terrain the generator grows,
// where the enemies stand and how the buildings are colored. Past the last
// region, every stage uses the last one. The built-in regions are data, in
// src/data/regions.json (loaded by src/data/regions.ts); this module holds
// their shape and the rules for picking a stage's region.

import type { EnemyGroup } from '../enemySpawns.ts';
import type { MapGenOptions } from '../mapGen.ts';
import type { Objective } from '../objectives.ts';
import type { BuildingPaletteName } from '../tileset.ts';

export interface RegionConfig {
  // The region's name, e.g. for a stage banner ("Stage 3: Highlands").
  name: string;
  // What the region is like, for whoever edits the configs.
  description?: string;
  // The generator's options, map size included (see mapGen.ts).
  terrain: MapGenOptions;
  // The enemy soldiers, in groups that each say where they may stand (see
  // enemySpawns.ts).
  enemies: readonly EnemyGroup[];
  // Chance (0–1) each free grass tile gets a decorative tree.
  treeChance: number;
  // The building and wall colors.
  palette: BuildingPaletteName;
  // What wins the battle, for a special map; a rout (defeat all enemies)
  // if unset.
  objective?: Objective;
}

// Everything Warband Mode reads per stage: the regions in order and how
// many stages each lasts. This is the shape of src/data/regions.json and
// of the files the config editor takes (see regionsFile.ts).
export interface RegionSettings {
  stagesPerRegion: number;
  regions: readonly RegionConfig[];
}

// The region for stage `stage` from `settings` (see getRegionConfig).
export function getStageRegion(stage: number, settings: RegionSettings): RegionConfig {
  return getRegionConfig(stage, settings.regions, settings.stagesPerRegion);
}

// The stages region `index` covers: { first, last }, with last null for
// the last region, which every stage past the others uses.
export function getRegionStages(
  index: number,
  regionCount: number,
  stagesPerRegion: number,
): { first: number; last: number | null } {
  const first = index * stagesPerRegion + 1;
  return { first, last: index === regionCount - 1 ? null : first + stagesPerRegion - 1 };
}

// The region for stage `stage` (1 is the first): stages 1 to
// `stagesPerRegion` use regions[0], the next `stagesPerRegion` use
// regions[1], and so on, sticking on the last region once they run out.
export function getRegionConfig(stage: number, regions: readonly RegionConfig[], stagesPerRegion = 1): RegionConfig {
  if (!Number.isInteger(stage) || stage < 1) throw new Error(`Stages start at 1, got ${stage}`);
  if (!Number.isInteger(stagesPerRegion) || stagesPerRegion < 1) {
    throw new Error(`Stages per region must be a whole number of at least 1, got ${stagesPerRegion}`);
  }
  if (regions.length === 0) throw new Error('No regions to pick from');
  const index = Math.floor((stage - 1) / stagesPerRegion);
  return regions[Math.min(index, regions.length - 1)];
}
