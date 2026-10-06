import { describe, expect, it } from 'vitest';
import { formatDungeonJson, formatDungeonSettings, parseDungeonSettings } from './dungeonConfigFile.ts';
import { DUNGEON_SETTINGS, DUNGEON_TEXT } from '../data/dungeon.ts';
import { NORTH_THIRD } from './enemySpawns.ts';

const floor = (overrides: Record<string, unknown> = {}) => ({
  name: 'Test Field',
  terrain: { width: 12, height: 10 },
  enemies: [{ count: 2 }],
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

  it('reads enemy groups with regions and distances', () => {
    const enemies = [
      { count: 2, region: { x: [0, 0.5], y: [0, 0.4] }, minDistance: 6 },
      { count: 1, maxDistance: 8 },
      { count: 1, minDistance: 3, maxDistance: 3 },
    ];
    expect(parseDungeonSettings(file([floor({ enemies })])).floors[0].enemies).toEqual(enemies);
  });

  it("reads an old file's enemyCount as that many enemies in the north third", () => {
    const old = { ...floor(), enemies: undefined, enemyCount: 3 };
    expect(parseDungeonSettings(file([old])).floors[0].enemies).toEqual([{ count: 3, region: NORTH_THIRD }]);
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
    ['no enemies', file([floor({ enemies: [] })]), /enemies must be a list of 1 to 10 enemy groups/],
    ['missing enemies', file([floor({ enemies: undefined })]), /floors\[0\]\.enemies must be a list/],
    [
      'both enemies and enemyCount',
      file([floor({ enemyCount: 2 })]),
      /floors\[0\] must set enemies or enemyCount, not both/,
    ],
    ['an old enemyCount of 0', file([floor({ enemies: undefined, enemyCount: 0 })]), /enemyCount must be a whole/],
    ['an empty group', file([floor({ enemies: [{ count: 0 }] })]), /enemies\[0\]\.count must be a whole number/],
    [
      'more than 30 enemies in all',
      file([floor({ enemies: [{ count: 20 }, { count: 11 }] })]),
      /enemies must add up to at most 30/,
    ],
    ['a typo in a group', file([floor({ enemies: [{ count: 1, minDist: 3 }] })]), /enemies\[0\]\.minDist isn't/],
    [
      'a fractional distance',
      file([floor({ enemies: [{ count: 1, maxDistance: 2.5 }] })]),
      /maxDistance must be a whole number from 1 to 100/,
    ],
    [
      'a backwards distance',
      file([floor({ enemies: [{ count: 1, minDistance: 8, maxDistance: 4 }] })]),
      /enemies\[0\] must have minDistance no larger than maxDistance/,
    ],
    [
      'a region past the map',
      file([floor({ enemies: [{ count: 1, region: { y: [0, 1.5] } }] })]),
      /region\.y\[1\] must be a number from 0 to 1/,
    ],
    [
      'an empty region',
      file([floor({ enemies: [{ count: 1, region: { x: [0.5, 0.5] } }] })]),
      /region\.x must have from smaller than to/,
    ],
    [
      'a region that is not a pair',
      file([floor({ enemies: [{ count: 1, region: { x: [0.5] } }] })]),
      /region\.x must be a \[from, to\] pair/,
    ],
    [
      'a typo in a region',
      file([floor({ enemies: [{ count: 1, region: { z: [0, 1] } }] })]),
      /region\.z isn't a known setting/,
    ],
    [
      'a max distance closer than the region',
      file([floor({ enemies: [{ count: 1, region: { y: [0, 0.3] }, maxDistance: 3 }] })]),
      /^floors\[0\]\.enemies\[0\]\.maxDistance is 3, but the closest spot in this group's region is \d+ steps from where your units start \(on a sample map\)\. Set it to \d+ or more, or move the region closer to the south edge\.$/,
    ],
    [
      'a min distance past the map',
      file([floor({ enemies: [{ count: 1 }, { count: 1, minDistance: 90 }] })]),
      /^floors\[0\]\.enemies\[1\]\.minDistance is 90, but the farthest spot on the map is only \d+ steps from where your units start \(on a sample map\)\. Set it to \d+ or less\.$/,
    ],
    [
      'a count bigger than its spots',
      file([floor({ enemies: [{ count: 30, maxDistance: 2 }] })]),
      /^floors\[0\]\.enemies\[0\]\.count is 30, but a sample map has only \d+ spots on the map within this group's distances\./,
    ],
    [
      'groups crowding each other out',
      // Each has room alone: the 5 tiles a step from the deployment zone.
      file([
        floor({
          enemies: [
            { count: 3, maxDistance: 1 },
            { count: 3, maxDistance: 1 },
          ],
        }),
      ]),
      /^floors\[0\]\.enemies ask for 6 enemies, but only 5 fit on a sample map because the groups compete for the same spots\./,
    ],
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

describe('formatDungeonSettings layout', () => {
  it('writes the built-in file exactly as it is', () => {
    expect(formatDungeonSettings(DUNGEON_SETTINGS)).toBe(DUNGEON_TEXT);
  });

  it('keeps the terrain settings in the order the file gives them', () => {
    const terrain = { height: 10, lakeSize: [3, 6], width: 12, lakes: 2 };
    expect(Object.keys(parseDungeonSettings(file([floor({ terrain })])).floors[0].terrain)).toEqual([
      'height',
      'lakeSize',
      'width',
      'lakes',
    ]);
  });

  it('puts what fits on one line and spreads out what does not', () => {
    const text = formatDungeonJson({ short: { a: [1, 2] }, long: { text: 'x'.repeat(130) }, list: [] });
    expect(text).toBe(
      [
        '{',
        '  "short": { "a": [1, 2] },',
        '  "long": {',
        `    "text": "${'x'.repeat(130)}"`,
        '  },',
        '  "list": []',
        '}',
        '',
      ].join('\n'),
    );
  });
});
