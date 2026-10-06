import { describe, expect, it } from 'vitest';
import { DUNGEON_SETTINGS, DUNGEON_TEXT } from '../data/dungeon.ts';
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
  NEW_FLOOR,
  pathLabel,
  readableError,
  readNumberText,
  removeAt,
  setIn,
  type Json,
} from './dungeonDraft.ts';

const DRAFT = draftFromSettings(DUNGEON_SETTINGS);

describe('draftFromSettings / draftText', () => {
  it('gives back the built-in file unchanged', () => {
    expect(draftText(DRAFT)).toBe(DUNGEON_TEXT);
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
    expect(setIn({}, ['region', 'y'], [0, 0.5])).toEqual({ region: { y: [0, 0.5] } });
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
    expect(pathLabel(['floors', 0, 'terrain', 'lakeSize', 1])).toBe('floors[0].terrain.lakeSize[1]');
    expect(pathLabel(['floorsPerConfig'])).toBe('floorsPerConfig');
  });

  it('matches an error to exactly its field', () => {
    const error = 'floors[1].enemies[0].count must be a whole number from 1 to 30';
    expect(isErrorAt(error, ['floors', 1, 'enemies', 0, 'count'])).toBe(true);
    expect(isErrorAt(error, ['floors', 1, 'enemies', 0])).toBe(false);
    expect(isErrorAt(error, ['floors', 1, 'enemies', 0, 'countX'])).toBe(false);
    expect(isErrorAt(null, ['floors'])).toBe(false);
  });

  it('matches a floor named by index and name', () => {
    const error = 'floors[2] (Highlands) fit only 3 of its 4 enemies on a test map (seed 1)';
    expect(isErrorAt(error, ['floors', 2])).toBe(true);
  });

  it('matches an error inside a path, but not a sibling that shares a prefix', () => {
    const error = 'floors[1].terrain.lakes must be a whole number from 0 to 50';
    expect(isErrorWithin(error, ['floors', 1])).toBe(true);
    expect(isErrorWithin(error, ['floors', 1, 'terrain'])).toBe(true);
    expect(isErrorWithin('floors[12].name must be text', ['floors', 1])).toBe(false);
    expect(isErrorWithin(error, ['floors', 0])).toBe(false);
  });
});

describe('checkDraft', () => {
  it('accepts the built-in settings', () => {
    expect(checkDraft(DRAFT)).toEqual({ settings: DUNGEON_SETTINGS, error: null });
  });

  it('accepts a new floor and a new enemy group', () => {
    let draft = insertAt(DRAFT, ['floors'], NEW_FLOOR);
    draft = insertAt(draft, ['floors', 0, 'enemies'], NEW_ENEMY_GROUP);
    const { settings } = checkDraft(draft);
    expect(settings?.floors).toHaveLength(DUNGEON_SETTINGS.floors.length + 1);
    expect(settings?.floors[0].enemies).toHaveLength(2);
  });

  it("names the field at fault when it doesn't parse", () => {
    const { error } = checkDraft(setIn(DRAFT, ['floors', 1, 'terrain', 'lakes'], 'lots'));
    expect(isErrorAt(error, ['floors', 1, 'terrain', 'lakes'])).toBe(true);
  });

  it('turns away a draft with no floors', () => {
    expect(checkDraft(setIn(DRAFT, ['floors'], [])).error).toMatch(/^floors must be a list/);
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
  const json = { floors: [{ name: 'Meadowlands' }, { name: '  ' }] };

  it.each([
    ['floors[0].enemies[0].maxDistance is 5, but ...', 'Meadowlands › Enemy group 1 › Max distance is 5, but ...'],
    ['floors[1].terrain.lakes must be a whole number', 'Floor config 2 › Lakes must be a whole number'],
    ['floors[0].terrain.lakeSize[1] must be ...', 'Meadowlands › Lake size max must be ...'],
    ['floors[0].terrain.lakeSize must have min ...', 'Meadowlands › Lake size must have min ...'],
    ['floors[0].enemies[2].region.y[0] must be ...', 'Meadowlands › Enemy group 3 › Region y from must be ...'],
    ['floors[0].enemies[0].region has no spots', 'Meadowlands › Enemy group 1 › Region has no spots'],
    ['floors[0].enemies ask for 4 enemies', 'Meadowlands › Enemy groups ask for 4 enemies'],
    ['floors[0] must set enemies or enemyCount', 'Meadowlands must set enemies or enemyCount'],
    ["floors[0].terrain.lake isn't a known setting", 'Meadowlands › "lake" isn\'t a known setting'],
    ['floors must be a list of 1 to 50', 'Floors must be a list of 1 to 50'],
    ['floorsPerConfig must be a whole number', 'Floors per config must be a whole number'],
    ["settings.extra isn't a known setting", 'The file › "extra" isn\'t a known setting'],
    ['floors[5].name must be text', 'Floor config 6 › Name must be text'],
  ])('reads %s', (error, readable) => {
    expect(readableError(error, json)).toBe(readable);
  });

  it('leaves errors without a path alone', () => {
    expect(readableError('Not valid JSON: Unexpected end', json)).toBe('Not valid JSON: Unexpected end');
  });

  it('copes with a file that is not an object', () => {
    expect(readableError('floors[0].name must be text', null)).toBe('Floor config 1 › Name must be text');
  });
});

describe('errorReason', () => {
  it('drops the path', () => {
    expect(errorReason('floors[0].enemies[0].maxDistance is 5, but ...')).toBe('is 5, but ...');
    expect(errorReason('Not valid JSON: oops')).toBe('Not valid JSON: oops');
  });
});
