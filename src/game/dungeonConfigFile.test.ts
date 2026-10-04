import { describe, expect, it } from 'vitest';
import { formatDungeonSettings, parseDungeonSettings } from './dungeonConfigFile.ts';
import { DUNGEON_SETTINGS } from '../data/dungeon.ts';

const floor = (overrides: Record<string, unknown> = {}) => ({
  name: 'Test Field',
  terrain: { width: 12, height: 10 },
  enemyCount: 2,
  treeChance: 0.05,
  palette: 'a-stone',
  ...overrides,
});

const file = (floors: unknown[], floorsPerConfig: unknown = 1) => JSON.stringify({ floorsPerConfig, floors });

describe('parseDungeonSettings', () => {
  it('reads a minimal file', () => {
    const settings = parseDungeonSettings(file([floor()], 2));
    expect(settings.floorsPerConfig).toBe(2);
    expect(settings.floors).toEqual([floor()]);
    expect(Object.isFrozen(settings.floors[0])).toBe(true);
  });

  it('reads every optional terrain setting and the objective', () => {
    const terrain = {
      width: 16,
      height: 14,
      lakes: 2,
      lakeSize: [3, 6],
      mountains: 1,
      mountainSize: [2, 4],
      forests: 3,
      forestSize: [3, 5],
      meadows: 0,
      meadowSize: [4, 4],
      castle: false,
      ruins: 1,
      buildings: 2,
      turnChance: 0.5,
    };
    const settings = parseDungeonSettings(file([floor({ terrain, objective: { kind: 'rout' } })]));
    expect(settings.floors[0].terrain).toEqual(terrain);
    expect(settings.floors[0].objective).toEqual({ kind: 'rout' });
  });

  it('trims the name', () => {
    expect(parseDungeonSettings(file([floor({ name: '  Glade ' })])).floors[0].name).toBe('Glade');
  });

  it('round-trips the built-in settings through formatDungeonSettings', () => {
    expect(parseDungeonSettings(formatDungeonSettings(DUNGEON_SETTINGS))).toEqual(DUNGEON_SETTINGS);
  });

  it.each([
    ['not json', '{', /Not valid JSON/],
    ['not an object', '[]', /settings must be an object/],
    [
      'an unknown top-level key',
      JSON.stringify({ floorsPerConfig: 1, floors: [floor()], extra: 1 }),
      /settings\.extra/,
    ],
    ['no floors', file([]), /floors must be a list of 1 to 50/],
    ['a fractional floorsPerConfig', file([floor()], 1.5), /floorsPerConfig must be a whole number from 1 to 100/],
    ['a missing name', file([floor({ name: '' })]), /floors\[0\]\.name must be text/],
    ['an unknown palette', file([floor({ palette: 'neon' })]), /floors\[0\]\.palette must be one of a-stone/],
    [
      'a map too small',
      file([floor({ terrain: { width: 3, height: 10 } })]),
      /terrain\.width must be a whole number from 6/,
    ],
    ['a map too big', file([floor({ terrain: { width: 12, height: 99 } })]), /terrain\.height/],
    ['a negative count', file([floor({ terrain: { width: 12, height: 10, lakes: -1 } })]), /terrain\.lakes/],
    [
      'a backwards range',
      file([floor({ terrain: { width: 12, height: 10, lakeSize: [6, 2] } })]),
      /lakeSize must have min/,
    ],
    [
      'a range that is not a pair',
      file([floor({ terrain: { width: 12, height: 10, lakeSize: [3] } })]),
      /\[min, max\] pair/,
    ],
    [
      'a non-boolean castle',
      file([floor({ terrain: { width: 12, height: 10, castle: 'yes' } })]),
      /castle must be true or false/,
    ],
    [
      'a typo in terrain',
      file([floor({ terrain: { width: 12, height: 10, lake: 2 } })]),
      /terrain\.lake isn't a known setting/,
    ],
    ['no enemies', file([floor({ enemyCount: 0 })]), /enemyCount must be a whole number from 1 to 30/],
    ['a tree chance over 1', file([floor({ treeChance: 2 })]), /treeChance must be a number from 0 to 1/],
    ['an unknown objective', file([floor({ objective: { kind: 'escape' } })]), /objective\.kind must be "rout"/],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseDungeonSettings(text)).toThrow(message);
  });

  it('names the floor at fault by index', () => {
    expect(() => parseDungeonSettings(file([floor(), floor({ treeChance: -1 })]))).toThrow(/^floors\[1\]\.treeChance/);
  });
});

describe('formatDungeonSettings', () => {
  it('keeps [min, max] pairs on one line', () => {
    const text = formatDungeonSettings(DUNGEON_SETTINGS);
    expect(text).toContain('"meadowSize": [5, 9]');
    expect(text.endsWith('\n')).toBe(true);
  });
});

describe('descriptions', () => {
  it('reads an optional description, kept right after the name', () => {
    const settings = parseDungeonSettings(file([floor({ description: ' Rolling hills. ' })]));
    expect(settings.floors[0].description).toBe('Rolling hills.');
    expect(Object.keys(settings.floors[0]).slice(0, 2)).toEqual(['name', 'description']);
  });

  it('leaves it out when unset', () => {
    expect(parseDungeonSettings(file([floor()])).floors[0]).not.toHaveProperty('description');
  });

  it('rejects a description that is not text or is too long', () => {
    expect(() => parseDungeonSettings(file([floor({ description: 3 })]))).toThrow(/description must be text/);
    expect(() => parseDungeonSettings(file([floor({ description: 'x'.repeat(301) })]))).toThrow(/description/);
  });
});

describe('checkMaps', () => {
  it('can skip test-generating the floors', () => {
    expect(parseDungeonSettings(file([floor()]), { checkMaps: false }).floors).toHaveLength(1);
  });
});
