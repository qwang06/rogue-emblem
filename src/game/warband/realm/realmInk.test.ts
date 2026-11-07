import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT } from '../../battleSetup.ts';
import { createGrid } from '../../grid.ts';
import { TILE_SIZE } from '../../tileset.ts';
import { generateRealm, getNextSites, getRoad, type Realm } from './realm.ts';
import {
  findPatches,
  getRealmInk,
  getRoadChains,
  getRouteLine,
  getSeasonBands,
  hashCell,
  INK_RULES,
  INK_STAMP_SIZE,
  pointAlong,
  SEASON_INK,
  simplifyLine,
  smoothLine,
  wobbleLine,
} from './realmInk.ts';

const SETTINGS = DEFAULT_CONTENT.regions;
const REALMS = [3, 7922, 15841, 23760].map((seed) => generateRealm(seed, SETTINGS));
const center = (p: { x: number; y: number }) => ({
  x: p.x * TILE_SIZE + TILE_SIZE / 2,
  y: p.y * TILE_SIZE + TILE_SIZE / 2,
});

// A little realm by hand: a row of land with the given terrain per cell.
function tinyRealm(terrain: string[]): Realm {
  const grid = createGrid(terrain.length, 1);
  return {
    seed: 1,
    name: 'Test',
    depth: 1,
    grid: { ...grid, cells: grid.cells.map((cell, i) => ({ ...cell, terrain: terrain[i] })) },
    sites: [],
    roads: [],
    shape: 'ranges',
    sea: null,
    rivers: [],
    seasons: ['summer', 'summer'],
    provinces: [],
    buildings: [],
    palette: 'a-orange',
  };
}

describe('getRealmInk', () => {
  it('is the same map every time for a realm, cached by realm', () => {
    expect(getRealmInk(REALMS[0])).toBe(getRealmInk(REALMS[0]));
  });

  it('covers the realm at a tile per 32 pixels, marking its water cells', () => {
    for (const realm of REALMS) {
      const ink = getRealmInk(realm);
      expect(ink.width).toBe(realm.grid.width * TILE_SIZE);
      expect(ink.height).toBe(realm.grid.height * TILE_SIZE);
      expect(ink.water).toEqual(realm.grid.cells.map((cell) => cell.terrain === 'water'));
    }
  });

  it('draws symbols back to front, near their own cells, and none on a site', () => {
    for (const realm of REALMS) {
      const { placements } = getRealmInk(realm);
      expect(placements.map((p) => p.y)).toEqual([...placements.map((p) => p.y)].sort((a, b) => a - b));
      for (const site of realm.sites) {
        const onSite = placements.filter(
          (p) => p.x === site.x * TILE_SIZE && p.y === site.y * TILE_SIZE && p.stamp.startsWith('grass'),
        );
        expect(onSite).toEqual([]);
      }
      for (const p of placements) {
        expect(p.x).toBeGreaterThan(-INK_STAMP_SIZE);
        expect(p.y).toBeGreaterThan(-INK_STAMP_SIZE);
        expect(p.x).toBeLessThan(realm.grid.width * TILE_SIZE);
        expect(p.y).toBeLessThan(realm.grid.height * TILE_SIZE);
      }
    }
  });

  it('puts trees on forests and peaks on mountains', () => {
    const ink = getRealmInk(tinyRealm(['forest', 'mountain', 'grass']));
    const trees = ink.placements.filter((p) => p.stamp.startsWith('tree'));
    const peaks = ink.placements.filter((p) => p.stamp.startsWith('mountain'));
    expect(trees).toHaveLength(INK_RULES.treesPerForest);
    expect(peaks).toHaveLength(1);
    expect(peaks[0].x).toBeGreaterThanOrEqual(TILE_SIZE - 3);
    expect(peaks[0].x).toBeLessThanOrEqual(TILE_SIZE + 3);
  });

  it('draws no waves on water that touches the shore', () => {
    const ink = getRealmInk(tinyRealm(['grass', 'water', 'water', 'grass']));
    expect(ink.placements.filter((p) => p.stamp === 'waves-1')).toEqual([]);
  });

  it('letters the big lakes, woods and ranges with names of their own, inside the map', () => {
    for (const realm of REALMS) {
      const { labels } = getRealmInk(realm);
      const names = labels.map((label) => label.text);
      expect(new Set(names).size).toBe(names.length);
      for (const label of labels) {
        expect(realm.sites.map((site) => site.name)).not.toContain(label.text);
        expect(label.x).toBeGreaterThan(0);
        expect(label.x).toBeLessThan(realm.grid.width * TILE_SIZE);
      }
      for (const kind of ['water', 'forest', 'mountain'] as const) {
        const big = findPatches(realm, kind).filter((patch) => patch.length >= INK_RULES.minNamed[kind]);
        expect(labels.filter((label) => label.kind === kind)).toHaveLength(Math.min(big.length, INK_RULES.maxNamed));
      }
    }
  });

  it('names nothing on a realm with no big patches', () => {
    expect(getRealmInk(tinyRealm(['water', 'forest', 'mountain'])).labels).toEqual([]);
  });
});

describe('getRoadChains', () => {
  it('covers every step of every road exactly once', () => {
    for (const realm of REALMS) {
      const key = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        [`${a.x},${a.y}`, `${b.x},${b.y}`].sort().join('|');
      const steps = new Set<string>();
      for (const road of realm.roads) {
        const from = realm.sites.find((site) => site.id === road.from)!;
        const to = realm.sites.find((site) => site.id === road.to)!;
        const tiles = [from, ...road.path, to];
        for (let i = 0; i < tiles.length - 1; i++) steps.add(key(tiles[i], tiles[i + 1]));
      }
      const drawn: string[] = [];
      for (const chain of getRoadChains(realm))
        for (let i = 0; i < chain.length - 1; i++) drawn.push(key(chain[i], chain[i + 1]));
      expect(drawn.length).toBe(steps.size);
      expect(new Set(drawn)).toEqual(steps);
    }
  });

  it('breaks chains only at sites, forks and dead ends', () => {
    const realm = REALMS[0];
    const sites = new Set(realm.sites.map((site) => `${site.x},${site.y}`));
    for (const chain of getRoadChains(realm)) {
      for (const tile of chain.slice(1, -1)) expect(sites.has(`${tile.x},${tile.y}`)).toBe(false);
    }
  });
});

describe('getRouteLine', () => {
  it("runs from a site's tile to the next site's tile along the drawn road", () => {
    for (const realm of REALMS) {
      const ink = getRealmInk(realm);
      for (const from of realm.sites) {
        for (const to of getNextSites(realm, from.id)) {
          const route = [from, ...getRoad(realm, from.id, to.id)!.path, to];
          const line = getRouteLine(ink, route);
          expect(line[0]).toEqual(center(from));
          expect(line[line.length - 1]).toEqual(center(to));
        }
      }
    }
  });

  it('falls back to a straight line through the tiles for a route off the roads', () => {
    const ink = getRealmInk(REALMS[0]);
    const route = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(getRouteLine(ink, route)).toEqual(route.map(center));
  });
});

describe('pointAlong', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];

  it('goes from the start to the end by length', () => {
    expect(pointAlong(line, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(line, 0.25)).toEqual({ x: 5, y: 0 });
    expect(pointAlong(line, 0.75)).toEqual({ x: 10, y: 5 });
    expect(pointAlong(line, 1)).toEqual({ x: 10, y: 10 });
  });

  it('clamps t, and copes with a single point or none', () => {
    expect(pointAlong(line, 2)).toEqual({ x: 10, y: 10 });
    expect(pointAlong(line, -1)).toEqual({ x: 0, y: 0 });
    expect(pointAlong([{ x: 3, y: 4 }], 0.5)).toEqual({ x: 3, y: 4 });
    expect(pointAlong([], 0.5)).toEqual({ x: 0, y: 0 });
  });
});

describe('line shaping', () => {
  const stairs = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
  ];

  it('simplifyLine turns a staircase into a slope and keeps the ends', () => {
    expect(simplifyLine(stairs, 0.75)).toEqual([stairs[0], stairs[stairs.length - 1]]);
    expect(simplifyLine(stairs, 0.1)).toEqual(stairs);
  });

  it('simplifyLine keeps a real corner', () => {
    const corner = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
    ];
    expect(simplifyLine(corner, 0.75)).toEqual(corner);
  });

  it('smoothLine cuts corners, keeping the ends', () => {
    const smooth = smoothLine(stairs, 2);
    expect(smooth[0]).toEqual(stairs[0]);
    expect(smooth[smooth.length - 1]).toEqual(stairs[stairs.length - 1]);
    expect(smooth.length).toBeGreaterThan(stairs.length);
    expect(smoothLine(stairs.slice(0, 2), 3)).toEqual(stairs.slice(0, 2));
  });

  it('wobbleLine keeps the ends and strays no further than asked', () => {
    const straight = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const wobbled = wobbleLine(straight, 5, 0.3);
    expect(wobbled[0]).toEqual(straight[0]);
    expect(wobbled[wobbled.length - 1]).toEqual(straight[1]);
    for (const p of wobbled) expect(Math.abs(p.y)).toBeLessThanOrEqual(0.3);
    expect(wobbleLine(straight, 5, 0.3)).toEqual(wobbled);
  });
});

describe('hashCell', () => {
  it('is between 0 and 1, and only depends on its arguments', () => {
    const rolls = Array.from({ length: 200 }, (_, i) => hashCell(9, i % 20, Math.floor(i / 20), 1));
    for (const roll of rolls) {
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThan(1);
    }
    expect(hashCell(9, 3, 4, 1)).toBe(hashCell(9, 3, 4, 1));
    expect(new Set(rolls).size).toBeGreaterThan(190);
  });
});

describe('seasons and rivers on the map', () => {
  it('bands the map by the depths’ seasons, runs of one season joined, covering every column', () => {
    for (const realm of REALMS) {
      const bands = getSeasonBands(realm);
      expect(bands[0].from).toBe(0);
      expect(bands[bands.length - 1].to).toBe(realm.grid.width);
      for (let i = 1; i < bands.length; i++) {
        expect(bands[i].from).toBe(bands[i - 1].to);
        expect(bands[i].season).not.toBe(bands[i - 1].season);
      }
      expect(new Set(bands.map((band) => band.season))).toEqual(new Set(realm.seasons));
    }
    expect(getSeasonBands(tinyRealm(['grass', 'grass', 'grass']))).toEqual([{ season: 'summer', from: 0, to: 3 }]);
  });

  it('draws each season’s own trees and peaks in its band', () => {
    const winter = REALMS.map((realm) => ({
      realm,
      band: getSeasonBands(realm).find((b) => b.season === 'winter'),
    })).find(({ band }) => band);
    if (!winter?.band) return;
    const { from, to } = winter.band;
    const inBand = getRealmInk(winter.realm).placements.filter(
      (p) => p.x + INK_STAMP_SIZE / 2 >= (from + 1) * TILE_SIZE && p.x + INK_STAMP_SIZE / 2 < (to - 1) * TILE_SIZE,
    );
    const stamps = new Set(inBand.map((p) => p.stamp));
    expect(
      [...stamps].some((s) => SEASON_INK.winter.trees.includes(s) || SEASON_INK.winter.mountains.includes(s)),
    ).toBe(true);
    expect(stamps.has('grass-1') || stamps.has('grass-2')).toBe(false);
  });

  it('lines each river through its tiles and bridges every road it crosses', () => {
    for (const realm of REALMS) {
      const ink = getRealmInk(realm);
      expect(ink.rivers).toHaveLength(realm.rivers.length);
      const roadTiles = new Set(
        [...realm.roads.flatMap((road) => road.path), ...realm.sites].map((p) => `${p.x},${p.y}`),
      );
      for (const [i, river] of ink.rivers.entries()) {
        expect(river.tiles).toEqual(realm.rivers[i]);
        expect(river.line[0]).toEqual(center(river.tiles[0]));
        expect(river.line[river.line.length - 1]).toEqual(center(river.tiles[river.tiles.length - 1]));
        for (const tile of river.tiles.slice(1, -1)) {
          if (!roadTiles.has(`${tile.x},${tile.y}`)) continue;
          const bridge = ink.placements.find(
            (p) =>
              (p.stamp === 'bridge-h' || p.stamp === 'bridge-v') &&
              p.x === tile.x * TILE_SIZE &&
              p.y === tile.y * TILE_SIZE,
          );
          expect(bridge).toBeDefined();
          // Both the river and the road pass through the middle of the bridge's tile.
          const middle = center(tile);
          expect(river.line.some((p) => p.x === middle.x && p.y === middle.y)).toBe(true);
          expect(ink.roads.some((road) => road.line.some((p) => p.x === middle.x && p.y === middle.y))).toBe(true);
        }
      }
    }
  });
});

describe('seas, provinces and landmarks on the map', () => {
  it('names a province for each of the realm’s, along the edge away from the sea', () => {
    for (const realm of REALMS) {
      const ink = getRealmInk(realm);
      const names = ink.labels.filter((label) => label.kind === 'province');
      expect(names.map((label) => label.text)).toEqual(realm.provinces.map((province) => province.name));
      expect(ink.labels.slice(0, names.length)).toEqual(names);
      for (const label of names) {
        if (realm.sea === 'north') expect(label.y).toBeGreaterThan((realm.grid.height - 2) * TILE_SIZE);
        else expect(label.y).toBeLessThan(2 * TILE_SIZE);
        expect(label.x).toBeGreaterThanOrEqual(0);
        expect(label.x).toBeLessThanOrEqual(realm.grid.width * TILE_SIZE);
      }
      expect(ink.provinces).toHaveLength(realm.provinces.length);
      expect(ink.provinces[0].from).toBe(0);
      expect(ink.provinces[ink.provinces.length - 1].to).toBe(realm.grid.width);
    }
  });

  it('sails ships only on the sea, and keeps reeds by the water and landmarks off the sites', () => {
    const cellOf = (p: { x: number; y: number }) => ({
      x: Math.floor((p.x + INK_STAMP_SIZE / 2) / TILE_SIZE),
      y: Math.floor((p.y + INK_STAMP_SIZE / 2) / TILE_SIZE),
    });
    for (const realm of REALMS) {
      const terrain = (x: number, y: number) => realm.grid.cells[y * realm.grid.width + x]?.terrain;
      for (const placement of getRealmInk(realm).placements) {
        const cell = cellOf(placement);
        if (placement.stamp === 'ship-1') {
          expect(realm.sea).not.toBeNull();
          expect(terrain(cell.x, cell.y)).toBe('water');
        } else if (placement.stamp === 'reeds-1') {
          const beside = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([dx, dy]) => terrain(cell.x + dx, cell.y + dy) === 'water');
          expect(beside).toBe(true);
        } else if (placement.stamp === 'ruin-1' || placement.stamp === 'stones-1' || placement.stamp === 'windmill-1') {
          expect(realm.sites.some((site) => Math.abs(site.x - cell.x) <= 2 && Math.abs(site.y - cell.y) <= 2)).toBe(
            false,
          );
        }
      }
    }
  });
});
