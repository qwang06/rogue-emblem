import { describe, expect, it } from 'vitest';
import { REGION_SETTINGS, REGIONS_TEXT } from '../data/regions.ts';
import {
  checkDraft,
  draftFromSettings,
  draftText,
  errorReason,
  getIn,
  insertAt,
  isErrorAt,
  isErrorWithin,
  moveItem,
  NEW_ENEMY_GROUP,
  NEW_REGION,
  pathLabel,
  readableError,
  readNumberText,
  removeAt,
  setIn,
  type Json,
} from './regionsDraft.ts';

const DRAFT = draftFromSettings(REGION_SETTINGS);

describe('draftFromSettings / draftText', () => {
  it('gives back the built-in file unchanged', () => {
    expect(draftText(DRAFT)).toBe(REGIONS_TEXT);
  });
});

describe('getIn / setIn', () => {
  const doc: Json = { a: { b: [1, 2, 3] } };

  it('reads nested values, undefined past the end', () => {
    expect(getIn(doc, ['a', 'b', 1])).toBe(2);
    expect(getIn(doc, ['a', 'x', 'y'])).toBeUndefined();
    expect(getIn(doc, [])).toBe(doc);
  });

  it('replaces a value without touching the original', () => {
    const next = setIn(doc, ['a', 'b', 1], 9);
    expect(next).toEqual({ a: { b: [1, 9, 3] } });
    expect(doc).toEqual({ a: { b: [1, 2, 3] } });
  });

  it('removes a key set to undefined', () => {
    expect(setIn({ a: 1, b: 2 }, ['a'], undefined)).toEqual({ b: 2 });
  });

  it('creates missing objects along the path', () => {
    expect(setIn({}, ['area', 'y'], [0, 0.5])).toEqual({ area: { y: [0, 0.5] } });
  });

  it('keeps a list item set to undefined as null, so the list keeps its length', () => {
    expect(setIn([1, 2], [0], undefined)).toEqual([null, 2]);
  });
});

describe('list edits', () => {
  const doc: Json = { list: ['a', 'b', 'c'] };

  it('inserts at the end or before an index', () => {
    expect(insertAt(doc, ['list'], 'd')).toEqual({ list: ['a', 'b', 'c', 'd'] });
    expect(insertAt(doc, ['list'], 'x', 1)).toEqual({ list: ['a', 'x', 'b', 'c'] });
    expect(insertAt({}, ['list'], 'x')).toEqual({ list: ['x'] });
  });

  it('removes by index', () => {
    expect(removeAt(doc, ['list'], 1)).toEqual({ list: ['a', 'c'] });
  });

  it('moves an item, ignoring moves out of range', () => {
    expect(moveItem(doc, ['list'], 0, 2)).toEqual({ list: ['b', 'c', 'a'] });
    expect(moveItem(doc, ['list'], 2, 1)).toEqual({ list: ['a', 'c', 'b'] });
    expect(moveItem(doc, ['list'], 0, -1)).toBe(doc);
    expect(moveItem(doc, ['list'], 2, 3)).toBe(doc);
  });
});

describe('error paths', () => {
  it('writes paths as the parser does', () => {
    expect(pathLabel(['regions', 0, 'terrain', 'lakeSize', 1])).toBe('regions[0].terrain.lakeSize[1]');
    expect(pathLabel(['stagesPerRegion'])).toBe('stagesPerRegion');
  });

  it('matches an error to exactly its field', () => {
    const error = 'regions[1].enemies[0].count must be a whole number from 1 to 30';
    expect(isErrorAt(error, ['regions', 1, 'enemies', 0, 'count'])).toBe(true);
    expect(isErrorAt(error, ['regions', 1, 'enemies', 0])).toBe(false);
    expect(isErrorAt(error, ['regions', 1, 'enemies', 0, 'countX'])).toBe(false);
    expect(isErrorAt(null, ['regions'])).toBe(false);
  });

  it('matches a region named by index and name', () => {
    const error = 'regions[2] (Highlands) fit only 3 of its 4 enemies on a test map (seed 1)';
    expect(isErrorAt(error, ['regions', 2])).toBe(true);
  });

  it('matches an error inside a path, but not a sibling that shares a prefix', () => {
    const error = 'regions[1].terrain.lakes must be a whole number from 0 to 50';
    expect(isErrorWithin(error, ['regions', 1])).toBe(true);
    expect(isErrorWithin(error, ['regions', 1, 'terrain'])).toBe(true);
    expect(isErrorWithin('regions[12].name must be text', ['regions', 1])).toBe(false);
    expect(isErrorWithin(error, ['regions', 0])).toBe(false);
  });
});

describe('checkDraft', () => {
  it('accepts the built-in settings', () => {
    expect(checkDraft(DRAFT)).toEqual({ settings: REGION_SETTINGS, error: null });
  });

  it('accepts a new region and a new enemy group', () => {
    let draft = insertAt(DRAFT, ['regions'], NEW_REGION);
    draft = insertAt(draft, ['regions', 0, 'enemies'], NEW_ENEMY_GROUP);
    const { settings } = checkDraft(draft);
    expect(settings?.regions).toHaveLength(REGION_SETTINGS.regions.length + 1);
    expect(settings?.regions[0].enemies).toHaveLength(2);
  });

  it("names the field at fault when it doesn't parse", () => {
    const { error } = checkDraft(setIn(DRAFT, ['regions', 1, 'terrain', 'lakes'], 'lots'));
    expect(isErrorAt(error, ['regions', 1, 'terrain', 'lakes'])).toBe(true);
  });

  it('turns away a draft with no regions', () => {
    expect(checkDraft(setIn(DRAFT, ['regions'], [])).error).toMatch(/^regions must be a list/);
  });
});

describe('readNumberText', () => {
  it('reads numbers, blanks and anything else', () => {
    expect(readNumberText(' 12 ')).toBe(12);
    expect(readNumberText('0.35')).toBe(0.35);
    expect(readNumberText('')).toBeUndefined();
    expect(readNumberText('  ')).toBeUndefined();
    expect(readNumberText('abc')).toBe('abc');
  });
});

describe('readableError', () => {
  const json = { regions: [{ name: 'Meadowlands' }, { name: '  ' }] };

  it.each([
    ['regions[0].enemies[0].maxDistance is 5, but ...', 'Meadowlands › Enemy group 1 › Max distance is 5, but ...'],
    ['regions[1].terrain.lakes must be a whole number', 'Region 2 › Lakes must be a whole number'],
    ['regions[0].terrain.lakeSize[1] must be ...', 'Meadowlands › Lake size max must be ...'],
    ['regions[0].terrain.lakeSize must have min ...', 'Meadowlands › Lake size must have min ...'],
    ['regions[0].enemies[2].area.y[0] must be ...', 'Meadowlands › Enemy group 3 › Area y from must be ...'],
    ['regions[0].enemies[0].area has no spots', 'Meadowlands › Enemy group 1 › Area has no spots'],
    ['regions[0].enemies ask for 4 enemies', 'Meadowlands › Enemy groups ask for 4 enemies'],
    ['regions[0] must set enemies or enemyCount', 'Meadowlands must set enemies or enemyCount'],
    ["regions[0].terrain.lake isn't a known setting", 'Meadowlands › "lake" isn\'t a known setting'],
    ['regions must be a list of 1 to 50', 'Regions must be a list of 1 to 50'],
    ['stagesPerRegion must be a whole number', 'Stages per region must be a whole number'],
    ["settings.extra isn't a known setting", 'The file › "extra" isn\'t a known setting'],
    ['regions[5].name must be text', 'Region 6 › Name must be text'],
  ])('reads %s', (error, readable) => {
    expect(readableError(error, json)).toBe(readable);
  });

  it("reads an old file's errors in its own keys", () => {
    const old = { floors: [{ name: 'Meadowlands' }] };
    expect(readableError('floors[0].enemies[1].region.x[1] must be ...', old)).toBe(
      'Meadowlands › Enemy group 2 › Area x to must be ...',
    );
    expect(readableError('floors[3].treeChance must be ...', old)).toBe('Region 4 › Tree chance must be ...');
    expect(readableError('floorsPerConfig must be ...', old)).toBe('Floors per config must be ...');
    expect(readableError('floors must be a list', old)).toBe('Regions must be a list');
  });

  it('leaves errors without a path alone', () => {
    expect(readableError('Not valid JSON: Unexpected end', json)).toBe('Not valid JSON: Unexpected end');
  });

  it('copes with a file that is not an object', () => {
    expect(readableError('regions[0].name must be text', null)).toBe('Region 1 › Name must be text');
  });
});

describe('errorReason', () => {
  it('drops the path', () => {
    expect(errorReason('regions[0].enemies[0].maxDistance is 5, but ...')).toBe('is 5, but ...');
    expect(errorReason('Not valid JSON: oops')).toBe('Not valid JSON: oops');
  });
});
