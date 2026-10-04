// Dungeon Mode's per-floor settings. A run goes down floor by floor (1, 2,
// 3, ...); every DUNGEON_FLOORS_PER_CONFIG floors it moves on to the next
// config in DUNGEON_CONFIGS, which sets that stretch's map size, how much of
// each terrain the generator grows, how many enemies there are and how the
// buildings are colored. Past the last config, every floor uses the last one.

import type { MapGenOptions } from './mapGen.ts';
import type { Objective } from './objectives.ts';
import type { BuildingPaletteName } from './tileset.ts';

export interface DungeonConfig {
  // A name for the stretch of floors, e.g. for a floor banner.
  name: string;
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

// How many floors in a row share a config.
export const DUNGEON_FLOORS_PER_CONFIG = 1;

export const DUNGEON_CONFIGS: readonly DungeonConfig[] = Object.freeze([
  // Open fields: a small map with a few lakes and hills and a farming village.
  {
    name: 'Meadowlands',
    terrain: {
      width: 14,
      height: 12,
      lakes: 1,
      mountains: 1,
      forests: 3,
      meadows: 4,
      meadowSize: [5, 9],
      ruins: 0,
      buildings: 3,
    },
    enemyCount: 2,
    treeChance: 0.05,
    palette: 'a-stone',
  },
  // Lake country: big lakes that funnel units onto the path.
  {
    name: 'Lakeside',
    terrain: {
      width: 16,
      height: 14,
      lakes: 4,
      lakeSize: [6, 11],
      mountains: 1,
      forests: 3,
      meadows: 2,
      ruins: 1,
      buildings: 2,
    },
    enemyCount: 3,
    treeChance: 0.04,
    palette: 'b-blue',
  },
  // Thick woods and a twisting path: lots of cover, slow going.
  {
    name: 'Deep Woods',
    terrain: {
      width: 16,
      height: 14,
      lakes: 1,
      mountains: 1,
      forests: 8,
      forestSize: [4, 9],
      meadows: 1,
      ruins: 1,
      buildings: 1,
      turnChance: 0.55,
    },
    enemyCount: 4,
    treeChance: 0.1,
    palette: 'a-brown',
  },
  // Mountain passes: ranges of impassable rock on a wider map.
  {
    name: 'Highlands',
    terrain: {
      width: 18,
      height: 14,
      lakes: 1,
      mountains: 5,
      mountainSize: [4, 9],
      forests: 3,
      meadows: 1,
      ruins: 2,
      buildings: 2,
    },
    enemyCount: 4,
    treeChance: 0.03,
    palette: 'b-white',
  },
  // A fortified borderland: the biggest map, walled ruins and a garrison.
  {
    name: 'Fortress',
    terrain: {
      width: 18,
      height: 16,
      lakes: 2,
      mountains: 2,
      forests: 3,
      meadows: 2,
      ruins: 3,
      buildings: 3,
    },
    enemyCount: 5,
    treeChance: 0.04,
    palette: 'b-red',
  },
]);

// The config for dungeon floor `floor` (1 is the first): floors 1 to
// `floorsPerConfig` use configs[0], the next `floorsPerConfig` use
// configs[1], and so on, sticking on the last config once they run out.
export function getDungeonConfig(
  floor: number,
  configs: readonly DungeonConfig[] = DUNGEON_CONFIGS,
  floorsPerConfig = DUNGEON_FLOORS_PER_CONFIG,
): DungeonConfig {
  if (!Number.isInteger(floor) || floor < 1) throw new Error(`Dungeon floors start at 1, got ${floor}`);
  if (!Number.isInteger(floorsPerConfig) || floorsPerConfig < 1) {
    throw new Error(`Floors per config must be a whole number of at least 1, got ${floorsPerConfig}`);
  }
  if (configs.length === 0) throw new Error('No dungeon configs to pick from');
  const index = Math.floor((floor - 1) / floorsPerConfig);
  return configs[Math.min(index, configs.length - 1)];
}
