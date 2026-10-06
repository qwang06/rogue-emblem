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
//         "enemies": [{ "count": 2, "region": { "y": [0, 0.34] }, "minDistance": 6 }],
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
// passes can't break a run or come up short of enemies. An old file's
// "enemyCount": n still reads, as n enemies in the north third.
// formatDungeonSettings writes settings back out.

import type { DungeonConfig, DungeonSettings } from './dungeonConfigs.ts';
import { createDungeonLevel } from './dungeonLevel.ts';
import { countEnemies, getGroupRoom, NORTH_THIRD, type EnemyGroup, type SpawnRegion } from './enemySpawns.ts';
import type { Grid, Point } from './grid.ts';
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
  enemyGroups: [1, 10],
  enemyDistance: [1, 100],
} as const);

// Seeds each floor is test-generated with.
const CHECK_SEEDS = [1, 2, 3];

const PATCH_COUNTS = ['lakes', 'mountains', 'forests', 'meadows', 'ruins', 'buildings'] as const;
const PATCH_SIZES = ['lakeSize', 'mountainSize', 'forestSize', 'meadowSize'] as const;
const TERRAIN_KEYS = ['width', 'height', ...PATCH_COUNTS, ...PATCH_SIZES, 'castle', 'turnChance'];
const FLOOR_KEYS = ['name', 'description', 'terrain', 'enemies', 'enemyCount', 'treeChance', 'palette', 'objective'];

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
  // In the file's order, so saving it back doesn't shuffle its settings.
  const ordered = Object.keys(json).map((key) => [key, terrain[key]]);
  return Object.freeze(Object.fromEntries(ordered)) as unknown as MapGenOptions;
}

function parseDescription(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  const [, max] = DUNGEON_LIMITS.descriptionLength;
  if (typeof value !== 'string' || value.length > max) fail(path, `must be text of at most ${max} characters`);
  return value.trim();
}

function fractions(value: unknown, path: string): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2) fail(path, 'must be a [from, to] pair');
  const [from, to] = value.map((n, i) => {
    if (typeof n !== 'number' || !(n >= 0 && n <= 1)) fail(`${path}[${i}]`, 'must be a number from 0 to 1');
    return n;
  });
  if (from >= to) fail(path, 'must have from smaller than to');
  return Object.freeze([from, to] as const);
}

function parseRegion(value: unknown, path: string): SpawnRegion {
  const json = object(value, path, ['x', 'y']);
  const region: { x?: readonly [number, number]; y?: readonly [number, number] } = {};
  if (json.x !== undefined) region.x = fractions(json.x, `${path}.x`);
  if (json.y !== undefined) region.y = fractions(json.y, `${path}.y`);
  return Object.freeze(region);
}

function parseEnemyGroup(value: unknown, path: string): EnemyGroup {
  const json = object(value, path, ['count', 'region', 'minDistance', 'maxDistance']);
  const group: { -readonly [K in keyof EnemyGroup]: EnemyGroup[K] } = {
    count: wholeNumber(json.count, `${path}.count`, DUNGEON_LIMITS.enemyCount),
  };
  if (json.region !== undefined) group.region = parseRegion(json.region, `${path}.region`);
  for (const key of ['minDistance', 'maxDistance'] as const) {
    if (json[key] !== undefined) group[key] = wholeNumber(json[key], `${path}.${key}`, DUNGEON_LIMITS.enemyDistance);
  }
  if (group.minDistance !== undefined && group.maxDistance !== undefined && group.minDistance > group.maxDistance) {
    fail(path, 'must have minDistance no larger than maxDistance');
  }
  return Object.freeze(group);
}

// The floor's enemy groups: its `enemies` list, or an old file's
// `enemyCount` read as that many in the north third.
function parseEnemies(json: Json, path: string): readonly EnemyGroup[] {
  if (json.enemies !== undefined && json.enemyCount !== undefined) {
    fail(path, 'must set enemies or enemyCount, not both');
  }
  if (json.enemyCount !== undefined) {
    const count = wholeNumber(json.enemyCount, `${path}.enemyCount`, DUNGEON_LIMITS.enemyCount);
    return Object.freeze([Object.freeze({ count, region: NORTH_THIRD })]);
  }
  const [minGroups, maxGroups] = DUNGEON_LIMITS.enemyGroups;
  if (!Array.isArray(json.enemies) || json.enemies.length < minGroups || json.enemies.length > maxGroups) {
    fail(`${path}.enemies`, `must be a list of ${minGroups} to ${maxGroups} enemy groups`);
  }
  const groups = json.enemies.map((group, i) => parseEnemyGroup(group, `${path}.enemies[${i}]`));
  const [, maxEnemies] = DUNGEON_LIMITS.enemyCount;
  if (countEnemies(groups) > maxEnemies) fail(`${path}.enemies`, `must add up to at most ${maxEnemies} enemies`);
  return Object.freeze(groups);
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
    enemies: parseEnemies(json, path),
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

// Why a floor's enemies didn't all fit on a sample map, aimed at the
// setting to change: [the setting's path, what's wrong and what to do].
// Each group is checked on its own first; if every group has room alone,
// they're crowding each other out.
export function explainEnemyShortfall(
  floor: DungeonConfig,
  index: number,
  level: { grid: Grid; deploymentZone: readonly Point[] },
  placed: number,
): [string, string] {
  for (const [g, group] of floor.enemies.entries()) {
    const at = `floors[${index}].enemies[${g}]`;
    const room = getGroupRoom(level.grid, group, level.deploymentZone);
    const where = group.region ? "in this group's region" : 'on the map';
    const { minDistance: min, maxDistance: max } = group;
    if (room.nearest === null || room.farthest === null) {
      return [`${at}.region`, 'has no spots your units can walk to on a sample map. Make it bigger.'];
    }
    if (max !== undefined && max < room.nearest) {
      return [
        `${at}.maxDistance`,
        `is ${max}, but the closest spot ${where} is ${room.nearest} steps from where your units start (on a sample map). Set it to ${room.nearest} or more${group.region ? ', or move the region closer to the south edge' : ''}.`,
      ];
    }
    if (min !== undefined && min > room.farthest) {
      return [
        `${at}.minDistance`,
        `is ${min}, but the farthest spot ${where} is only ${room.farthest} steps from where your units start (on a sample map). Set it to ${room.farthest} or less${group.region ? ', or make the region bigger' : ''}.`,
      ];
    }
    if (room.fits < group.count) {
      const spots = room.fits === 0 ? 'no spots' : `only ${plural(room.fits, 'spot')}`;
      return [
        `${at}.count`,
        `is ${group.count}, but a sample map has ${spots} ${where} within this group's distances. Lower the count or loosen the group's limits.`,
      ];
    }
  }
  return [
    `floors[${index}].enemies`,
    `ask for ${countEnemies(floor.enemies)} enemies, but only ${placed} fit on a sample map because the groups compete for the same spots. Give the groups different regions or distances, or fewer enemies.`,
  ];
}

const plural = (n: number, noun: string) => `${n} ${n === 1 ? noun : `${noun}s`}`;
// Parses and checks a dungeon settings file. Throws an Error naming the
// field at fault (or the floor that couldn't generate a map, or fit all its
// enemies on one). `checkMaps` false skips generating each floor, for files
// already known to work (the built-in one, which the test suite checks).
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
      let level: ReturnType<typeof createDungeonLevel>;
      try {
        level = createDungeonLevel(seed, floor);
      } catch (error) {
        fail(`floors[${i}]`, `couldn't generate a map: ${(error as Error).message}`);
      }
      const placed = [...level.units.values()].filter((unit) => unit.team === 'enemy').length;
      if (placed < countEnemies(floor.enemies)) fail(...explainEnemyShortfall(floor, i, level, placed));
    }
  });

  return Object.freeze({ floorsPerConfig, floors: Object.freeze(floors) });
}

// The settings as a dungeon settings file, readable and ready to edit
// (see formatDungeonJson).
export function formatDungeonSettings(settings: DungeonSettings): string {
  const { floorsPerConfig, floors } = settings;
  return formatDungeonJson({ floorsPerConfig, floors });
}

// Lines the formatter keeps within, as the repo's Prettier config does.
const LINE_WIDTH = 120;

// Any JSON value laid out like a dungeon settings file, and as Prettier
// keeps it: two-space indents, with any object or list that fits on its
// line written on one (e.g. [min, max] pairs and short enemy groups). For
// settings still being edited too, which may not parse yet.
export function formatDungeonJson(json: unknown): string {
  return `${layoutJson(json, '', 0)}\n`;
}

function inlineJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inlineJson).join(', ')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inlineJson(v)}`).join(', ')} }`;
  }
  return JSON.stringify(value ?? null);
}

// `value` at `indent`, after `prefix` characters (its key) on the same
// line; the top level always spreads out.
function layoutJson(value: unknown, indent: string, prefix: number): string {
  const inline = inlineJson(value);
  if (!value || typeof value !== 'object') return inline;
  // +1 for a trailing comma.
  if (indent !== '' && indent.length + prefix + inline.length + 1 <= LINE_WIDTH) return inline;
  const inner = `${indent}  `;
  const lines = Array.isArray(value)
    ? value.map((item) => `${inner}${layoutJson(item, inner, 0)}`)
    : Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => {
          const key = `${JSON.stringify(k)}: `;
          return `${inner}${key}${layoutJson(v, inner, key.length)}`;
        });
  if (lines.length === 0) return inline;
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  return `${open}\n${lines.join(',\n')}\n${indent}${close}`;
}
