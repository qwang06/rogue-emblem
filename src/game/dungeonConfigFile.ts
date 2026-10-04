// Dungeon Mode's floor settings as a JSON file, so players can write their
// own and upload them in the config editor:
//
//   {
//     "floorsPerConfig": 1,
//     "floors": [
//       {
//         "name": "Meadowlands",
//         "description": "Open fields and a farming village.",
//         "terrain": { "width": 14, "height": 12, "lakes": 1, "meadowSize": [5, 9] },
//         "enemyCount": 2,
//         "treeChance": 0.05,
//         "palette": "a-stone"
//       }
//     ]
//   }
//
// parseDungeonSettings checks every field (types, ranges, known palettes,
// no unknown keys, so typos don't pass silently) and throws naming the
// field at fault, e.g. "floors[2].terrain.lakes must be a whole number from
// 0 to 50". It then generates each floor on a few seeds, so a file that
// passes can't break a run. formatDungeonSettings writes settings back out.

import type { DungeonConfig, DungeonSettings } from './dungeonConfigs.ts';
import { createDungeonLevel } from './dungeonLevel.ts';
import type { MapGenOptions } from './mapGen.ts';
import { BUILDING_PALETTES, type BuildingPaletteName } from './tileset.ts';

// The bounds each number must fall in.
export const DUNGEON_LIMITS = Object.freeze({
  floorsPerConfig: [1, 100],
  floors: [1, 50],
  nameLength: [1, 40],
  descriptionLength: [0, 300],
  mapSize: [6, 48],
  patchCount: [0, 50],
  patchSize: [1, 200],
  enemyCount: [1, 30],
} as const);

// Seeds each floor is test-generated with.
const CHECK_SEEDS = [1, 2, 3];

const PATCH_COUNTS = ['lakes', 'mountains', 'forests', 'meadows', 'ruins', 'buildings'] as const;
const PATCH_SIZES = ['lakeSize', 'mountainSize', 'forestSize', 'meadowSize'] as const;
const TERRAIN_KEYS = ['width', 'height', ...PATCH_COUNTS, ...PATCH_SIZES, 'castle', 'turnChance'];
const FLOOR_KEYS = ['name', 'description', 'terrain', 'enemyCount', 'treeChance', 'palette', 'objective'];

type Json = Record<string, unknown>;

class DungeonFileError extends Error {}

function fail(path: string, message: string): never {
  throw new DungeonFileError(`${path} ${message}`);
}

function object(value: unknown, path: string, keys: readonly string[]): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object');
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) fail(`${path}.${key}`, `isn't a known setting (expected one of ${keys.join(', ')})`);
  }
  return value as Json;
}

function wholeNumber(value: unknown, path: string, [min, max]: readonly [number, number]): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    fail(path, `must be a whole number from ${min} to ${max}`);
  }
  return value as number;
}

function chance(value: unknown, path: string): number {
  if (typeof value !== 'number' || !(value >= 0 && value <= 1)) fail(path, 'must be a number from 0 to 1');
  return value;
}

function sizeRange(value: unknown, path: string): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2) fail(path, 'must be a [min, max] pair');
  const min = wholeNumber(value[0], `${path}[0]`, DUNGEON_LIMITS.patchSize);
  const max = wholeNumber(value[1], `${path}[1]`, DUNGEON_LIMITS.patchSize);
  if (min > max) fail(path, 'must have min no larger than max');
  return Object.freeze([min, max] as const);
}

function parseTerrain(value: unknown, path: string): MapGenOptions {
  const json = object(value, path, TERRAIN_KEYS);
  const terrain: Record<string, unknown> = {
    width: wholeNumber(json.width, `${path}.width`, DUNGEON_LIMITS.mapSize),
    height: wholeNumber(json.height, `${path}.height`, DUNGEON_LIMITS.mapSize),
  };
  for (const key of PATCH_COUNTS) {
    if (json[key] !== undefined) terrain[key] = wholeNumber(json[key], `${path}.${key}`, DUNGEON_LIMITS.patchCount);
  }
  for (const key of PATCH_SIZES) {
    if (json[key] !== undefined) terrain[key] = sizeRange(json[key], `${path}.${key}`);
  }
  if (json.castle !== undefined) {
    if (typeof json.castle !== 'boolean') fail(`${path}.castle`, 'must be true or false');
    terrain.castle = json.castle;
  }
  if (json.turnChance !== undefined) terrain.turnChance = chance(json.turnChance, `${path}.turnChance`);
  return Object.freeze(terrain) as unknown as MapGenOptions;
}

function parseDescription(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  const [, max] = DUNGEON_LIMITS.descriptionLength;
  if (typeof value !== 'string' || value.length > max) fail(path, `must be text of at most ${max} characters`);
  return value.trim();
}

function parseFloor(value: unknown, path: string): DungeonConfig {
  const json = object(value, path, FLOOR_KEYS);
  const [minName, maxName] = DUNGEON_LIMITS.nameLength;
  if (typeof json.name !== 'string' || json.name.trim().length < minName || json.name.trim().length > maxName) {
    fail(`${path}.name`, `must be text of ${minName} to ${maxName} characters`);
  }
  if (typeof json.palette !== 'string' || !Object.hasOwn(BUILDING_PALETTES, json.palette)) {
    fail(`${path}.palette`, `must be one of ${Object.keys(BUILDING_PALETTES).join(', ')}`);
  }
  const description = parseDescription(json.description, `${path}.description`);
  const floor: DungeonConfig = {
    name: json.name.trim(),
    // Only present when set, and right after the name, so files read in order.
    ...(description === undefined ? {} : { description }),
    terrain: parseTerrain(json.terrain, `${path}.terrain`),
    enemyCount: wholeNumber(json.enemyCount, `${path}.enemyCount`, DUNGEON_LIMITS.enemyCount),
    treeChance: chance(json.treeChance, `${path}.treeChance`),
    palette: json.palette as BuildingPaletteName,
  };
  if (json.objective !== undefined) {
    const objective = object(json.objective, `${path}.objective`, ['kind']);
    if (objective.kind !== 'rout') fail(`${path}.objective.kind`, 'must be "rout"');
    floor.objective = Object.freeze({ kind: 'rout' });
  }
  return Object.freeze(floor);
}

// Parses and checks a dungeon settings file. Throws an Error naming the
// field at fault (or the floor that couldn't generate a map). `checkMaps`
// false skips generating each floor, for files already known to work (the
// built-in one, which the test suite checks).
export function parseDungeonSettings(text: string, { checkMaps = true } = {}): DungeonSettings {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`Not valid JSON: ${(error as Error).message}`);
  }
  const root = object(json, 'settings', ['floorsPerConfig', 'floors']);
  const floorsPerConfig = wholeNumber(root.floorsPerConfig, 'floorsPerConfig', DUNGEON_LIMITS.floorsPerConfig);
  const [minFloors, maxFloors] = DUNGEON_LIMITS.floors;
  if (!Array.isArray(root.floors) || root.floors.length < minFloors || root.floors.length > maxFloors) {
    fail('floors', `must be a list of ${minFloors} to ${maxFloors} floor configs`);
  }
  const floors = root.floors.map((floor, i) => parseFloor(floor, `floors[${i}]`));

  floors.forEach((floor, i) => {
    if (!checkMaps) return;
    for (const seed of CHECK_SEEDS) {
      try {
        createDungeonLevel(seed, floor);
      } catch (error) {
        fail(`floors[${i}] (${floor.name})`, `couldn't generate a map: ${(error as Error).message}`);
      }
    }
  });

  return Object.freeze({ floorsPerConfig, floors: Object.freeze(floors) });
}

// The settings as a dungeon settings file, readable and ready to edit:
// two-space indents, with [min, max] pairs kept on one line.
export function formatDungeonSettings(settings: DungeonSettings): string {
  const { floorsPerConfig, floors } = settings;
  const text = JSON.stringify({ floorsPerConfig, floors }, null, 2);
  return `${text.replace(/\[\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2]')}\n`;
}
