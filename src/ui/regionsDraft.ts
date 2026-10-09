// The Regions editor's working copy: the settings as plain JSON,
// which the form edits one field at a time and which may be invalid while
// it's being typed. Edits return a new draft (nothing is mutated). The
// draft is checked by the same parser uploads go through, and its error
// names the field at fault in the parser's path syntax, e.g.
// "regions[1].enemies[0].count must be ...", which pathLabel matches.

import { formatRegionsJson, formatRegionSettings, parseRegionSettings } from '../game/warband/regionsFile.ts';
import type { RegionSettings } from '../game/warband/regions.ts';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type DraftPath = readonly (string | number)[];

// What a form field holds: undefined clears the setting.
export type DraftValue = Json | undefined;

// A region the editor adds: a small open map with two enemies up north.
export const NEW_REGION: Json = Object.freeze({
  name: 'New Region',
  terrain: { width: 14, height: 12 },
  enemies: [{ count: 2, area: { y: [0, 0.34] } }],
  treeChance: 0.05,
  palette: 'a-stone',
});

export const NEW_ENEMY_GROUP: Json = Object.freeze({ count: 1 });

export function draftFromSettings(settings: RegionSettings): Json {
  return JSON.parse(formatRegionSettings(settings));
}

// The draft as file text, laid out as the saved file would be.
export function draftText(draft: Json): string {
  return formatRegionsJson(draft);
}

export function getIn(draft: Json | undefined, path: DraftPath): DraftValue {
  let value: DraftValue = draft;
  for (const key of path) {
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Record<string | number, Json>)[key];
  }
  return value;
}

// The draft with the value at `path` replaced; undefined removes an
// object's key. Missing objects along the way are created.
export function setIn(draft: Json | undefined, path: DraftPath, value: DraftValue): Json {
  if (path.length === 0) return value ?? null;
  const [key, ...rest] = path;
  const child = rest.length === 0 ? value : setIn(getIn(draft, [key]), rest, value);
  if (Array.isArray(draft) && typeof key === 'number') {
    const next = [...draft];
    next[key] = child ?? null;
    return next;
  }
  const next: Record<string, Json> = draft && typeof draft === 'object' && !Array.isArray(draft) ? { ...draft } : {};
  if (child === undefined) delete next[key];
  else next[key] = child;
  return next;
}

function listAt(draft: Json, path: DraftPath): Json[] {
  const list = getIn(draft, path);
  return Array.isArray(list) ? list : [];
}

// The list at `path` with `item` inserted before `index` (the end by default).
export function insertAt(draft: Json, path: DraftPath, item: Json, index?: number): Json {
  const list = [...listAt(draft, path)];
  list.splice(index ?? list.length, 0, item);
  return setIn(draft, path, list);
}

export function removeAt(draft: Json, path: DraftPath, index: number): Json {
  return setIn(
    draft,
    path,
    listAt(draft, path).filter((_, i) => i !== index),
  );
}

// The list at `path` with item `from` moved to `to`; unchanged if either
// is out of range.
export function moveItem(draft: Json, path: DraftPath, from: number, to: number): Json {
  const list = [...listAt(draft, path)];
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return draft;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return setIn(draft, path, list);
}

// The path as the parser writes it: regions[0].terrain.lakeSize[1].
export function pathLabel(path: DraftPath): string {
  return path.map((key, i) => (typeof key === 'number' ? `[${key}]` : i === 0 ? key : `.${key}`)).join('');
}

// Whether `error` is about `path` itself (not something inside it).
export function isErrorAt(error: string | null, path: DraftPath): boolean {
  if (error === null) return false;
  const label = pathLabel(path);
  // "regions[0] (Name) fit only ..." names a region by index and name.
  return error.startsWith(`${label} `);
}

// Whether `error` is about `path` or anything inside it.
export function isErrorWithin(error: string | null, path: DraftPath): boolean {
  if (error === null) return false;
  const label = pathLabel(path);
  return error.startsWith(label) && /^[ .[]/.test(error.slice(label.length));
}

// The settings a draft stands for, test-generated like an upload, or the
// parser's error.
export function checkDraft(draft: Json): { settings: RegionSettings; error: null } | { settings: null; error: string } {
  try {
    return { settings: parseRegionSettings(draftText(draft)), error: null };
  } catch (error) {
    return { settings: null, error: (error as Error).message };
  }
}

// What a text field's contents mean: blank clears the setting, a number
// is a number, and anything else is kept as text for the parser to reject.
export function readNumberText(text: string): DraftValue {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : trimmed;
}

// What the form calls each setting, for readable errors.
const SETTING_LABELS: Readonly<Record<string, string>> = Object.freeze({
  stagesPerRegion: 'Stages per region',
  floorsPerConfig: 'Floors per config',
  name: 'Name',
  description: 'Description',
  width: 'Width',
  height: 'Height',
  lakes: 'Lakes',
  lakeSize: 'Lake size',
  mountains: 'Mountain ranges',
  mountainSize: 'Mountain range size',
  forests: 'Forests',
  forestSize: 'Forest size',
  meadows: 'Meadows',
  meadowSize: 'Meadow size',
  ruins: 'Walled ruins',
  buildings: 'Buildings',
  castle: 'Castle',
  turnChance: 'Path winding',
  enemyCount: 'Enemy count',
  count: 'Count',
  minDistance: 'Min distance',
  maxDistance: 'Max distance',
  treeChance: 'Tree chance',
  palette: 'Palette',
  objective: 'Objective',
  kind: 'Kind',
});

const PAIR_ENDS: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  lakeSize: ['min', 'max'],
  mountainSize: ['min', 'max'],
  forestSize: ['min', 'max'],
  meadowSize: ['min', 'max'],
  x: ['from', 'to'],
  y: ['from', 'to'],
});

// A parser error's path (its first word, e.g. regions[0].terrain.lakes)
// and the rest. An old file's errors name its own keys (floorsPerConfig,
// floors; see regionsFile.ts).
const ERROR_PATH = /^((?:settings|stagesPerRegion|regions|floorsPerConfig|floors)(?:[.[]\S*)?) (.*)$/s;

// The lists of regions, and the areas in an enemy group, under their new
// and old names.
const REGION_LISTS = ['regions', 'floors'];
const AREAS = ['area', 'region'];

// What an error says without its path, e.g. "must be a whole number from
// 0 to 50", to show beside the field it names.
export function errorReason(error: string): string {
  return ERROR_PATH.exec(error)?.[2] ?? error;
}

// A parser error with its path spelled out the way the form labels things,
// e.g. "regions[0].enemies[0].maxDistance is 5, ..." becomes "Meadowlands ›
// Enemy group 1 › Max distance is 5, ...". `json` is the file or draft the
// error is about, for region names. Errors without a path pass through.
export function readableError(error: string, json: unknown): string {
  const match = ERROR_PATH.exec(error);
  if (!match) return error;
  const [, path, rest] = match;
  const keys = [...path.matchAll(/([A-Za-z]+)|\[(\d+)\]/g)].map(([, key, index]) => key ?? Number(index));
  const labels: string[] = [];
  keys.forEach((key, i) => {
    const prev = keys[i - 1];
    const last = i === keys.length - 1;
    if (typeof key === 'number') {
      if (REGION_LISTS.includes(prev as string)) {
        const name = getIn(json as Json, [prev, key, 'name']);
        labels.push(typeof name === 'string' && name.trim() ? name.trim() : `Region ${key + 1}`);
      } else if (prev === 'enemies') labels.push(`Enemy group ${key + 1}`);
      else if (typeof prev === 'string' && PAIR_ENDS[prev] && key < 2)
        labels.push(`${labels.pop()} ${PAIR_ENDS[prev][key]}`);
      else labels.push(`item ${key + 1}`);
    } else if (key === 'settings') labels.push('The file');
    else if (REGION_LISTS.includes(key) || key === 'enemies') {
      if (typeof keys[i + 1] !== 'number') labels.push(key === 'enemies' ? 'Enemy groups' : 'Regions');
    } else if (key === 'terrain' || (AREAS.includes(key) && keys[i - 2] === 'enemies')) {
      if (last) labels.push(key === 'terrain' ? 'Terrain' : 'Area');
    } else if (AREAS.includes(prev as string) && (key === 'x' || key === 'y')) labels.push(`Area ${key}`);
    else labels.push(SETTING_LABELS[key] ?? `"${key}"`);
  });
  return `${labels.join(' › ')} ${rest}`;
}
