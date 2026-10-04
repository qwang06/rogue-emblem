// Dungeon Mode's per-floor settings. A run goes down floor by floor (1, 2,
// 3, ...); every `floorsPerConfig` floors it moves on to the next config,
// which sets that stretch's map size, how much of each terrain the
// generator grows, how many enemies there are and how the buildings are
// colored. Past the last config, every floor uses the last one. The
// built-in settings are data, in src/data/dungeon.json (loaded by
// src/data/dungeon.ts); this module holds their shape and the rules for
// picking a floor's config.

import type { MapGenOptions } from './mapGen.ts';
import type { Objective } from './objectives.ts';
import type { BuildingPaletteName } from './tileset.ts';

export interface DungeonConfig {
  // A name for the stretch of floors, e.g. for a floor banner.
  name: string;
  // What the stretch is like, for whoever edits the configs.
  description?: string;
  // The generator's options, map size included (see mapGen.ts).
  terrain: MapGenOptions;
  // How many enemy soldiers stand in the north third.
  enemyCount: number;
  // Chance (0–1) each free grass tile gets a decorative tree.
  treeChance: number;
  // The building and wall colors.
  palette: BuildingPaletteName;
  // What wins the battle, for a special map; a rout (defeat all enemies)
  // if unset.
  objective?: Objective;
}

// Everything Dungeon Mode reads per floor: the configs in order and how
// many floors share each. This is the shape of src/data/dungeon.json and
// of the files the config editor takes (see dungeonConfigFile.ts).
export interface DungeonSettings {
  floorsPerConfig: number;
  floors: readonly DungeonConfig[];
}

// The config for dungeon floor `floor` from `settings` (see getDungeonConfig).
export function getDungeonFloor(floor: number, settings: DungeonSettings): DungeonConfig {
  return getDungeonConfig(floor, settings.floors, settings.floorsPerConfig);
}

// The floors config `index` covers: { first, last }, with last null for
// the last config, which every floor past the others uses.
export function getConfigFloors(
  index: number,
  configCount: number,
  floorsPerConfig: number,
): { first: number; last: number | null } {
  const first = index * floorsPerConfig + 1;
  return { first, last: index === configCount - 1 ? null : first + floorsPerConfig - 1 };
}

// The config for dungeon floor `floor` (1 is the first): floors 1 to
// `floorsPerConfig` use configs[0], the next `floorsPerConfig` use
// configs[1], and so on, sticking on the last config once they run out.
export function getDungeonConfig(floor: number, configs: readonly DungeonConfig[], floorsPerConfig = 1): DungeonConfig {
  if (!Number.isInteger(floor) || floor < 1) throw new Error(`Dungeon floors start at 1, got ${floor}`);
  if (!Number.isInteger(floorsPerConfig) || floorsPerConfig < 1) {
    throw new Error(`Floors per config must be a whole number of at least 1, got ${floorsPerConfig}`);
  }
  if (configs.length === 0) throw new Error('No dungeon configs to pick from');
  const index = Math.floor((floor - 1) / floorsPerConfig);
  return configs[Math.min(index, configs.length - 1)];
}
