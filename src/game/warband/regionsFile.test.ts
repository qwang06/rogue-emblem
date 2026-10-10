import { describe, expect, it } from 'vitest';
import { formatRegionsJson, formatRegionSettings, parseRegionSettings } from './regionsFile.ts';
import { REGION_SETTINGS, REGIONS_TEXT } from '../../data/regions.ts';
import { NORTH_THIRD } from '../enemySpawns.ts';

const region = (overrides: Record<string, unknown> = {}) => ({
  name: 'Test Field',
  terrain: { width: 12, height: 10 },
  enemies: [{ count: 2 }],
  treeChance: 0.05,
  palette: 'a-stone',
  ...overrides,
});

const file = (regions: unknown[], stagesPerRegion: unknown = 1) => JSON.stringify({ stagesPerRegion, regions });

describe('parseRegionSettings', () => {
  it('reads a minimal file', () => {
    const settings = parseRegionSettings(file([region()], 2));
    expect(settings.stagesPerRegion).toBe(2);
    expect(settings.regions).toEqual([region()]);
    expect(Object.isFrozen(settings.regions[0])).toBe(true);
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
    const settings = parseRegionSettings(file([region({ terrain, objective: { kind: 'rout' } })]));
    expect(settings.regions[0].terrain).toEqual(terrain);
    expect(settings.regions[0].objective).toEqual({ kind: 'rout' });
  });

  it('trims the name', () => {
    expect(parseRegionSettings(file([region({ name: '  Glade ' })])).regions[0].name).toBe('Glade');
  });

  it('reads enemy groups with classes, areas, distances, health and levelUpOnKill', () => {
    const enemies = [
      { count: 2, area: { x: [0, 0.5], y: [0, 0.4] }, minDistance: 6 },
      { count: 1, maxDistance: 8, levelUpOnKill: false },
      { count: 1, unitClass: 'villager', minDistance: 3, maxDistance: 3, health: 4, levelUpOnKill: true },
      { count: 1, unitClass: 'archer' },
    ];
    expect(parseRegionSettings(file([region({ enemies })])).regions[0].enemies).toEqual(enemies);
  });

  it("reads an old file's enemyCount as that many enemies in the north third", () => {
    const old = { ...region(), enemies: undefined, enemyCount: 3 };
    expect(parseRegionSettings(file([old])).regions[0].enemies).toEqual([{ count: 3, area: NORTH_THIRD }]);
  });

  describe('a Dungeon Mode file from before the rename', () => {
    const oldFile = (floors: unknown[], floorsPerConfig: unknown = 1) => JSON.stringify({ floorsPerConfig, floors });

    it('reads floorsPerConfig and floors as stagesPerRegion and regions', () => {
      const old = region({ enemies: [{ count: 2, region: { y: [0, 0.34] }, minDistance: 6 }] });
      const settings = parseRegionSettings(oldFile([old, region({ name: 'Second' })], 2));
      expect(settings.stagesPerRegion).toBe(2);
      expect(settings.regions.map((r) => r.name)).toEqual(['Test Field', 'Second']);
      expect(settings.regions[0].enemies).toEqual([{ count: 2, area: { y: [0, 0.34] }, minDistance: 6 }]);
    });

    it('writes it back out in the new shape', () => {
      const text = formatRegionSettings(parseRegionSettings(oldFile([region()])));
      expect(JSON.parse(text)).toEqual({ stagesPerRegion: 1, regions: [region()] });
    });

    it('names its own keys in errors', () => {
      expect(() => parseRegionSettings(oldFile([region({ treeChance: 2 })]))).toThrow(/^floors\[0\]\.treeChance/);
      expect(() => parseRegionSettings(oldFile([region()], 0))).toThrow(/^floorsPerConfig must be/);
      expect(() => parseRegionSettings(oldFile([]))).toThrow(/^floors must be a list/);
      const crowded = region({ enemies: [{ count: 1, region: { y: [0, 0.3] }, maxDistance: 3 }] });
      expect(() => parseRegionSettings(oldFile([crowded]))).toThrow(/^floors\[0\]\.enemies\[0\]\.maxDistance is 3/);
    });

    it('rejects old and new keys mixed', () => {
      const mixed = JSON.stringify({ stagesPerRegion: 1, floors: [region()] });
      expect(() => parseRegionSettings(mixed)).toThrow(/^settings\.floors isn't a known setting/);
    });
  });

  it("reads an enemy group's old region as its area, but not both", () => {
    const enemies = [{ count: 1, region: { x: [0, 0.5] } }];
    expect(parseRegionSettings(file([region({ enemies })])).regions[0].enemies).toEqual([
      { count: 1, area: { x: [0, 0.5] } },
    ]);
    const both = [{ count: 1, area: { x: [0, 0.5] }, region: { x: [0, 0.5] } }];
    expect(() => parseRegionSettings(file([region({ enemies: both })]))).toThrow(
      /^regions\[0\]\.enemies\[0\] must set area or region, not both/,
    );
    const typo = [{ count: 1, region: { z: [0, 1] } }];
    expect(() => parseRegionSettings(file([region({ enemies: typo })]))).toThrow(/enemies\[0\]\.region\.z isn't/);
  });

  it('round-trips the built-in settings through formatRegionSettings', () => {
    expect(parseRegionSettings(formatRegionSettings(REGION_SETTINGS))).toEqual(REGION_SETTINGS);
  });

  it.each([
    ['not json', '{', /Not valid JSON/],
    ['not an object', '[]', /settings must be an object/],
    [
      'an unknown top-level key',
      JSON.stringify({ stagesPerRegion: 1, regions: [region()], extra: 1 }),
      /settings\.extra/,
    ],
    ['no regions', file([]), /regions must be a list of 1 to 50 regions/],
    ['a fractional stagesPerRegion', file([region()], 1.5), /stagesPerRegion must be a whole number from 1 to 100/],
    ['a missing name', file([region({ name: '' })]), /regions\[0\]\.name must be text/],
    ['an unknown palette', file([region({ palette: 'neon' })]), /regions\[0\]\.palette must be one of a-stone/],
    [
      'a map too small',
      file([region({ terrain: { width: 3, height: 10 } })]),
      /terrain\.width must be a whole number from 6/,
    ],
    ['a map too big', file([region({ terrain: { width: 12, height: 99 } })]), /terrain\.height/],
    ['a negative count', file([region({ terrain: { width: 12, height: 10, lakes: -1 } })]), /terrain\.lakes/],
    [
      'a backwards range',
      file([region({ terrain: { width: 12, height: 10, lakeSize: [6, 2] } })]),
      /lakeSize must have min/,
    ],
    [
      'a range that is not a pair',
      file([region({ terrain: { width: 12, height: 10, lakeSize: [3] } })]),
      /\[min, max\] pair/,
    ],
    [
      'a non-boolean castle',
      file([region({ terrain: { width: 12, height: 10, castle: 'yes' } })]),
      /castle must be true or false/,
    ],
    [
      'a typo in terrain',
      file([region({ terrain: { width: 12, height: 10, lake: 2 } })]),
      /terrain\.lake isn't a known setting/,
    ],
    ['no enemies', file([region({ enemies: [] })]), /enemies must be a list of 1 to 10 enemy groups/],
    ['missing enemies', file([region({ enemies: undefined })]), /regions\[0\]\.enemies must be a list/],
    [
      'both enemies and enemyCount',
      file([region({ enemyCount: 2 })]),
      /regions\[0\] must set enemies or enemyCount, not both/,
    ],
    ['an old enemyCount of 0', file([region({ enemies: undefined, enemyCount: 0 })]), /enemyCount must be a whole/],
    ['an empty group', file([region({ enemies: [{ count: 0 }] })]), /enemies\[0\]\.count must be a whole number/],
    [
      'more than 30 enemies in all',
      file([region({ enemies: [{ count: 20 }, { count: 11 }] })]),
      /enemies must add up to at most 30/,
    ],
    ['a typo in a group', file([region({ enemies: [{ count: 1, minDist: 3 }] })]), /enemies\[0\]\.minDist isn't/],
    [
      'a fractional distance',
      file([region({ enemies: [{ count: 1, maxDistance: 2.5 }] })]),
      /maxDistance must be a whole number from 1 to 100/,
    ],
    [
      'an enemy health of 0',
      file([region({ enemies: [{ count: 1, health: 0 }] })]),
      /enemies\[0\]\.health must be a whole number from 1 to 99/,
    ],
    [
      'an unknown enemy class',
      file([region({ enemies: [{ count: 1, unitClass: 'dragon' }] })]),
      /enemies\[0\]\.unitClass must be one of villager, soldier, archer/,
    ],
    [
      'a levelUpOnKill that is not true or false',
      file([region({ enemies: [{ count: 1, levelUpOnKill: 'yes' }] })]),
      /enemies\[0\]\.levelUpOnKill must be true or false/,
    ],
    [
      'a backwards distance',
      file([region({ enemies: [{ count: 1, minDistance: 8, maxDistance: 4 }] })]),
      /enemies\[0\] must have minDistance no larger than maxDistance/,
    ],
    [
      'an area past the map',
      file([region({ enemies: [{ count: 1, area: { y: [0, 1.5] } }] })]),
      /area\.y\[1\] must be a number from 0 to 1/,
    ],
    [
      'an empty area',
      file([region({ enemies: [{ count: 1, area: { x: [0.5, 0.5] } }] })]),
      /area\.x must have from smaller than to/,
    ],
    [
      'an area that is not a pair',
      file([region({ enemies: [{ count: 1, area: { x: [0.5] } }] })]),
      /area\.x must be a \[from, to\] pair/,
    ],
    [
      'a typo in an area',
      file([region({ enemies: [{ count: 1, area: { z: [0, 1] } }] })]),
      /area\.z isn't a known setting/,
    ],
    [
      'a max distance closer than the area',
      file([region({ enemies: [{ count: 1, area: { y: [0, 0.3] }, maxDistance: 3 }] })]),
      /^regions\[0\]\.enemies\[0\]\.maxDistance is 3, but the closest spot in this group's area is \d+ steps from where your units start \(on a sample map\)\. Set it to \d+ or more, or move the area closer to the south edge\.$/,
    ],
    [
      'a min distance past the map',
      file([region({ enemies: [{ count: 1 }, { count: 1, minDistance: 90 }] })]),
      /^regions\[0\]\.enemies\[1\]\.minDistance is 90, but the farthest spot on the map is only \d+ steps from where your units start \(on a sample map\)\. Set it to \d+ or less\.$/,
    ],
    [
      'a count bigger than its spots',
      file([region({ enemies: [{ count: 30, maxDistance: 2 }] })]),
      /^regions\[0\]\.enemies\[0\]\.count is 30, but a sample map has only \d+ spots on the map within this group's distances\./,
    ],
    [
      'groups crowding each other out',
      // Each has room alone: the 5 tiles a step from the deployment zone.
      file([
        region({
          enemies: [
            { count: 3, maxDistance: 1 },
            { count: 3, maxDistance: 1 },
          ],
        }),
      ]),
      /^regions\[0\]\.enemies ask for 6 enemies, but only 5 fit on a sample map because the groups compete for the same spots\./,
    ],
    ['a tree chance over 1', file([region({ treeChance: 2 })]), /treeChance must be a number from 0 to 1/],
    ['an unknown objective', file([region({ objective: { kind: 'escape' } })]), /objective\.kind must be "rout"/],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseRegionSettings(text)).toThrow(message);
  });

  it('names the region at fault by index', () => {
    expect(() => parseRegionSettings(file([region(), region({ treeChance: -1 })]))).toThrow(
      /^regions\[1\]\.treeChance/,
    );
  });
});

describe('formatRegionSettings', () => {
  it('keeps [min, max] pairs on one line', () => {
    const text = formatRegionSettings(REGION_SETTINGS);
    expect(text).toContain('"meadowSize": [5, 9]');
    expect(text.endsWith('\n')).toBe(true);
  });
});

describe('descriptions', () => {
  it('reads an optional description, kept right after the name', () => {
    const settings = parseRegionSettings(file([region({ description: ' Rolling hills. ' })]));
    expect(settings.regions[0].description).toBe('Rolling hills.');
    expect(Object.keys(settings.regions[0]).slice(0, 2)).toEqual(['name', 'description']);
  });

  it('leaves it out when unset', () => {
    expect(parseRegionSettings(file([region()])).regions[0]).not.toHaveProperty('description');
  });

  it('rejects a description that is not text or is too long', () => {
    expect(() => parseRegionSettings(file([region({ description: 3 })]))).toThrow(/description must be text/);
    expect(() => parseRegionSettings(file([region({ description: 'x'.repeat(301) })]))).toThrow(/description/);
  });
});

describe('checkMaps', () => {
  it('can skip test-generating the regions', () => {
    expect(parseRegionSettings(file([region()]), { checkMaps: false }).regions).toHaveLength(1);
  });
});

describe('formatRegionSettings layout', () => {
  it('writes the built-in file exactly as it is', () => {
    expect(formatRegionSettings(REGION_SETTINGS)).toBe(REGIONS_TEXT);
  });

  it('keeps the terrain settings in the order the file gives them', () => {
    const terrain = { height: 10, lakeSize: [3, 6], width: 12, lakes: 2 };
    expect(Object.keys(parseRegionSettings(file([region({ terrain })])).regions[0].terrain)).toEqual([
      'height',
      'lakeSize',
      'width',
      'lakes',
    ]);
  });

  it('puts what fits on one line and spreads out what does not', () => {
    const text = formatRegionsJson({ short: { a: [1, 2] }, long: { text: 'x'.repeat(130) }, list: [] });
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
