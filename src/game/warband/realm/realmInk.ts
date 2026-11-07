// The realm drawn as an old parchment map, the way Tactics Ogre and Final
// Fantasy Tactics show their world maps: lakes as washed shapes with an
// inked coast, forests and mountains as little hand-drawn map symbols,
// roads as inked lines, and the big lakes, woods and ranges lettered with
// names. This module lays the map out (what goes where); inkRaster.ts
// paints it. Sites aren't part of it: the overworld screen stands an
// illustrated icon on each. Pure: the same realm always gives the same map.

import type { Rng } from '../../combatStats.ts';
import type { Point } from '../../grid.ts';
import { createSeededRng, randomItem } from '../../rng.ts';
import { TILE_SIZE, type Season } from '../../tileset.ts';
import { REALM_COLUMN_SPACING, REALM_MARGIN, type Realm } from './realm.ts';
import { riverCrossings } from './realmRivers.ts';
import { getRoadNetwork } from './realmRoutes.ts';
import type { RealmTerrain } from './realmTerrain.ts';

// The map symbols, each a 32x32 image in src/assets/realm/ink/ named by id.
export const INK_STAMPS = [
  'tree-pine-1',
  'tree-pine-2',
  'tree-round-1',
  'tree-round-2',
  'tree-pine-snow-1',
  'tree-pine-snow-2',
  'tree-bare-1',
  'tree-bare-2',
  'mountain-1',
  'mountain-2',
  'mountain-3',
  'mountain-snow-1',
  'mountain-snow-2',
  'mountain-snow-3',
  'hill-1',
  'grass-1',
  'grass-2',
  'crack-1',
  'crack-2',
  'waves-1',
  'ship-1',
  'serpent-1',
  'reeds-1',
  'ruin-1',
  'stones-1',
  'windmill-1',
  'bridge-h',
  'bridge-v',
] as const;
export type InkStamp = (typeof INK_STAMPS)[number];

// The symbols each season draws: its trees, its peaks, the tufts on open
// ground (none where the ground is bare) and what else marks the ground
// there, with how likely an open cell is to get one.
export interface SeasonInk {
  trees: readonly InkStamp[];
  mountains: readonly InkStamp[];
  tufts: readonly InkStamp[];
  ground: readonly InkStamp[];
  groundChance: number;
}

const SUMMER_INK: SeasonInk = {
  trees: ['tree-pine-1', 'tree-pine-2', 'tree-round-1', 'tree-round-2'],
  mountains: ['mountain-1', 'mountain-2', 'mountain-3'],
  tufts: ['grass-1', 'grass-2'],
  ground: [],
  groundChance: 0,
};

export const SEASON_INK: Readonly<Record<Season, SeasonInk>> = Object.freeze({
  summer: SUMMER_INK,
  // Autumn woods are mostly broadleaf.
  autumn: { ...SUMMER_INK, trees: ['tree-round-1', 'tree-round-2', 'tree-round-1', 'tree-pine-1'] },
  // Winter: snow on the pines and the peaks, bare trees, no grass.
  winter: {
    trees: ['tree-pine-snow-1', 'tree-pine-snow-2', 'tree-bare-1', 'tree-bare-2'],
    mountains: ['mountain-snow-1', 'mountain-snow-2', 'mountain-snow-3'],
    tufts: [],
    ground: [],
    groundChance: 0,
  },
  // The underworld: dead trees and cracked ground.
  underworld: {
    trees: ['tree-bare-1', 'tree-bare-2'],
    mountains: ['mountain-1', 'mountain-2', 'mountain-3'],
    tufts: [],
    ground: ['crack-1', 'crack-2'],
    groundChance: 0.14,
  },
  starship: SUMMER_INK,
});

// The size every stamp is drawn at, in map pixels.
export const INK_STAMP_SIZE = 32;

export interface InkPlacement {
  stamp: InkStamp;
  // The stamp's top-left corner, in map pixels.
  x: number;
  y: number;
}

export type InkLabelKind = 'water' | 'forest' | 'mountain' | 'province';

export interface InkLabel {
  text: string;
  kind: InkLabelKind;
  // The middle of the label, in map pixels.
  x: number;
  y: number;
}

export interface InkRoad {
  tiles: readonly Point[];
  line: readonly Point[];
}

// A river: its tiles from source to mouth, and the line drawn for it in
// pixels, which runs through the middle of every tile where it crosses a
// road, so the bridge stamped there sits over both.
export interface InkRiver {
  tiles: readonly Point[];
  line: readonly Point[];
}

// A stretch of the map in one season, by columns of tiles: from `from`
// up to (not including) `to`. The paper changes color with the season.
export interface InkBand {
  season: Season;
  from: number;
  to: number;
}

// A province by columns of tiles, `from` up to (not including) `to`,
// with its name; a dotted border is drawn where one meets the next.
export interface InkProvince {
  name: string;
  from: number;
  to: number;
}

export interface RealmInk {
  // The map's size, in pixels.
  width: number;
  height: number;
  // Which cells are water, row by row (index y * columns + x).
  water: readonly boolean[];
  // Every symbol, back to front (by the bottom of the stamp).
  placements: readonly InkPlacement[];
  // The road network in stretches between sites and forks: each
  // stretch's tiles, and the smoothed line drawn for it, in pixels.
  roads: readonly InkRoad[];
  rivers: readonly InkRiver[];
  // West to east, covering every column.
  bands: readonly InkBand[];
  provinces: readonly InkProvince[];
  // Which cells are mountain and forest (index y * columns + x), for the
  // engraver's hatching and stipple around them.
  mountains: readonly boolean[];
  forests: readonly boolean[];
  labels: readonly InkLabel[];
}

// How likely a cell of each terrain is to get a tuft of grass, and the
// smallest patch of each lettered terrain that gets a name.
export const INK_RULES = Object.freeze({
  meadowTuft: 0.55,
  grassTuft: 0.07,
  waves: 0.4,
  treesPerForest: 2,
  // A mountain cell with no mountain north of it gets a hill in front
  // half the time, so ranges have foothills.
  foothill: 0.5,
  minNamed: { water: 8, forest: 10, mountain: 8 } as Readonly<Record<InkLabelKind, number>>,
  // At most this many names of each kind, biggest patches first.
  maxNamed: 2,
  // About how wide a lettered name's letters are, in tiles (the screen
  // sets them at 0.6–0.7 of a tile, spaced out).
  letterWidth: 0.5,
  // How far (in tiles) a road may stray from its tiles when its steps are
  // straightened into slopes, and the Chaikin passes that then round off
  // its corners.
  roadSimplify: 0.75,
  roadSmoothing: 3,
  // How far (in tiles) a road wanders either side of its course, as if
  // drawn by hand.
  roadWobble: 0.3,
  // A river wanders more than a road.
  riverWobble: 0.45,
  // Ships and serpents on open sea (and serpents on open lakes), reeds on
  // open ground beside water, and landmarks (ruins, standing stones, a
  // windmill on a meadow) out on open ground away from sites and roads.
  ship: 0.06,
  serpent: 0.025,
  reeds: 0.35,
  ruin: 0.009,
  stones: 0.009,
  windmill: 0.006,
  // A sea's name needs it to run along the edge this many cells.
  seaCells: 10,
});

const inkCache = new WeakMap<Realm, RealmInk>();

// The parchment map for `realm` (see the top of this file), cached per
// realm so returning to the overworld reuses it.
export function getRealmInk(realm: Realm): RealmInk {
  const cached = inkCache.get(realm);
  if (cached) return cached;
  const { grid } = realm;
  const terrainAt = (x: number, y: number): RealmTerrain | undefined =>
    x < 0 || y < 0 || x >= grid.width || y >= grid.height
      ? undefined
      : (grid.cells[y * grid.width + x].terrain as RealmTerrain);
  const siteTiles = new Set(realm.sites.map((site) => `${site.x},${site.y}`));
  const nearSite = (x: number, y: number) =>
    realm.sites.some((site) => Math.abs(site.x - x) <= 2 && Math.abs(site.y - y) <= 2);
  const bands = getSeasonBands(realm);
  const seasonAt = (x: number) => SEASON_INK[(bands.find((band) => x >= band.from && x < band.to) ?? bands[0]).season];
  const placements: InkPlacement[] = [];
  const half = TILE_SIZE / 2;

  for (const cell of grid.cells) {
    const { x, y } = cell;
    const terrain = cell.terrain as RealmTerrain;
    const left = x * TILE_SIZE;
    const top = y * TILE_SIZE;
    const season = seasonAt(x);
    const roll = (k: number) => hashCell(realm.seed, x, y, k);
    const jitter = (k: number, spread: number) => Math.round((roll(k) - 0.5) * 2 * spread);
    if (terrain === 'forest') {
      for (let i = 0; i < INK_RULES.treesPerForest; i++) {
        placements.push({
          stamp: pick(roll(10 + i), season.trees),
          x: left + (i === 0 ? -6 : 6) + jitter(20 + i, 4),
          y: top + (i === 0 ? -6 : 4) + jitter(30 + i, 3),
        });
      }
    } else if (terrain === 'mountain') {
      placements.push({
        stamp: pick(roll(1), season.mountains),
        x: left + jitter(2, 3),
        y: top - 6 + jitter(3, 2),
      });
      if (terrainAt(x, y + 1) !== 'mountain' && roll(4) < INK_RULES.foothill)
        placements.push({ stamp: 'hill-1', x: left + jitter(5, 6), y: top + 12 });
    } else if (terrain === 'water') {
      // Beyond the map's edge counts as water, so the sea along it is open.
      const wet = (dx: number, dy: number) => (terrainAt(x + dx, y + dy) ?? 'water') === 'water';
      const open = [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => wet(dx, dy)));
      const atSea = realm.sea !== null && (realm.sea === 'north' ? y < 4 : y >= grid.height - 4);
      if (!open) {
        // Nothing on a shore.
      } else if (atSea && roll(8) < INK_RULES.ship) {
        placements.push({ stamp: 'ship-1', x: left + jitter(2, 3), y: top + jitter(3, 3) });
      } else if (roll(8) < INK_RULES.ship + INK_RULES.serpent) {
        placements.push({ stamp: 'serpent-1', x: left + jitter(2, 3), y: top + jitter(3, 3) });
      } else if (roll(1) < INK_RULES.waves) {
        placements.push({ stamp: 'waves-1', x: left + jitter(2, 4), y: top + jitter(3, 4) });
      }
    } else if ((terrain === 'meadow' || terrain === 'grass') && !siteTiles.has(`${x},${y}`)) {
      const shore = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => terrainAt(x + dx, y + dy) === 'water');
      const chance = terrain === 'meadow' ? INK_RULES.meadowTuft : INK_RULES.grassTuft;
      const landmark = roll(11);
      if (shore && roll(12) < INK_RULES.reeds) {
        placements.push({ stamp: 'reeds-1', x: left + jitter(13, 4), y: top + jitter(14, 3) });
      } else if (!nearSite(x, y) && landmark < INK_RULES.ruin) {
        placements.push({ stamp: 'ruin-1', x: left, y: top - 4 });
      } else if (!nearSite(x, y) && landmark < INK_RULES.ruin + INK_RULES.stones) {
        placements.push({ stamp: 'stones-1', x: left, y: top - 4 });
      } else if (
        terrain === 'meadow' &&
        !nearSite(x, y) &&
        landmark < INK_RULES.ruin + INK_RULES.stones + INK_RULES.windmill
      ) {
        placements.push({ stamp: 'windmill-1', x: left, y: top - 8 });
      } else if (season.tufts.length > 0 && roll(1) < chance)
        placements.push({
          stamp: pick(roll(2), season.tufts),
          x: left + jitter(3, 8),
          y: top + jitter(4, 8),
        });
      else if (season.ground.length > 0 && roll(6) < season.groundChance)
        placements.push({ stamp: pick(roll(7), season.ground), x: left + jitter(8, 6), y: top + jitter(9, 6) });
    }
  }

  // Rivers, their lines pinned to the middle of every tile where they
  // cross a road, with a bridge stamped there across the river.
  const roadTiles = new Set([...realm.roads.flatMap((road) => road.path), ...realm.sites].map((p) => `${p.x},${p.y}`));
  const toPixels = (point: Point) => ({ x: point.x * TILE_SIZE + half, y: point.y * TILE_SIZE + half });
  const crossingTiles = new Set<string>();
  const rivers = realm.rivers.map((tiles) => {
    const crossings = riverCrossings(tiles, roadTiles);
    for (const { tile, northSouth } of crossings) {
      crossingTiles.add(`${tile.x},${tile.y}`);
      placements.push({ stamp: northSouth ? 'bridge-h' : 'bridge-v', x: tile.x * TILE_SIZE, y: tile.y * TILE_SIZE });
    }
    const pins = new Set(crossings.map(({ tile }) => `${tile.x},${tile.y}`));
    return Object.freeze({
      tiles: Object.freeze([...tiles]),
      line: Object.freeze(drawLine(tiles, pins, realm.seed ^ 0x72697665, INK_RULES.riverWobble).map(toPixels)),
    });
  });
  placements.sort((a, b) => a.y - b.y || a.x - b.x);

  const provinces = getProvinceBands(realm);
  const roads = getRoadChains(realm, crossingTiles).map((tiles) =>
    Object.freeze({
      tiles: Object.freeze(tiles),
      line: Object.freeze(drawLine(tiles, new Set(), realm.seed, INK_RULES.roadWobble).map(toPixels)),
    }),
  );

  const ink: RealmInk = Object.freeze({
    width: grid.width * TILE_SIZE,
    height: grid.height * TILE_SIZE,
    water: Object.freeze(grid.cells.map((cell) => cell.terrain === 'water')),
    placements: Object.freeze(placements.map((placement) => Object.freeze(placement))),
    roads: Object.freeze(roads),
    rivers: Object.freeze(rivers),
    bands: Object.freeze(bands),
    provinces: Object.freeze(provinces),
    mountains: Object.freeze(grid.cells.map((cell) => cell.terrain === 'mountain')),
    forests: Object.freeze(grid.cells.map((cell) => cell.terrain === 'forest')),
    labels: Object.freeze(nameFeatures(realm, nameProvinces(realm, provinces))),
  });
  inkCache.set(realm, ink);
  return ink;
}

// The hand-drawn line (in tiles) for a run of `tiles`: its steps
// straightened into slopes, wobbled and rounded off, in stretches between
// the `pins` (tile keys) it must pass through exactly.
function drawLine(tiles: readonly Point[], pins: ReadonlySet<string>, seed: number, wobble: number): Point[] {
  const line: Point[] = [];
  let start = 0;
  for (let i = 1; i < tiles.length; i++) {
    if (i < tiles.length - 1 && !pins.has(`${tiles[i].x},${tiles[i].y}`)) continue;
    const stretch = smoothLine(
      wobbleLine(simplifyLine(tiles.slice(start, i + 1), INK_RULES.roadSimplify), seed, wobble),
      INK_RULES.roadSmoothing,
    );
    line.push(...(line.length > 0 ? stretch.slice(1) : stretch));
    start = i;
  }
  return line.length > 0 ? line : tiles.map(({ x, y }) => ({ x, y }));
}

// The map's seasons as bands of columns: each depth's season (realm.ts)
// from halfway to the column before it to halfway to the next, runs of
// the same season joined. A realm with no seasons is all summer.
export function getSeasonBands(realm: Realm): InkBand[] {
  const columns = realm.grid.width;
  const seasons = realm.seasons.length > 0 ? realm.seasons : (['summer'] as const);
  const bands: InkBand[] = [];
  for (let d = 0; d < seasons.length; d++) {
    const from = d === 0 ? 0 : REALM_MARGIN + (d - 0.5) * REALM_COLUMN_SPACING;
    const to = d === seasons.length - 1 ? columns : REALM_MARGIN + (d + 0.5) * REALM_COLUMN_SPACING;
    const last = bands[bands.length - 1];
    if (last && last.season === seasons[d]) last.to = to;
    else bands.push({ season: seasons[d], from, to });
  }
  bands[bands.length - 1].to = columns;
  return bands;
}

// The provinces (realm.ts) as stretches of columns, cut like the season
// bands: halfway between the columns of neighboring depths. Named after
// the region each plays, when the realm knows one.
export function getProvinceBands(realm: Realm): InkProvince[] {
  const columns = realm.grid.width;
  return realm.provinces.map((province, i) => ({
    name: province.name,
    from: i === 0 ? 0 : REALM_MARGIN + (province.from - 0.5) * REALM_COLUMN_SPACING,
    to: i === realm.provinces.length - 1 ? columns : REALM_MARGIN + (province.to + 0.5) * REALM_COLUMN_SPACING,
  }));
}

// Each province's name lettered along the map's edge (the one the sea
// isn't on), over the middle of its stretch, kept inside the map, on two
// rows by turns so neighbors' names don't run together.
function nameProvinces(realm: Realm, provinces: readonly InkProvince[]): InkLabel[] {
  const width = realm.grid.width * TILE_SIZE;
  const rows = realm.sea === 'north' ? [realm.grid.height - 0.7, realm.grid.height - 1.55] : [0.7, 1.55];
  return provinces
    .filter((province) => province.name)
    .map((province, i) => {
      const reach = Math.min(width / 2, (province.name.length * INK_RULES.letterWidth * 1.5 * TILE_SIZE) / 2);
      const middle = ((province.from + province.to) / 2) * TILE_SIZE;
      return Object.freeze({
        text: province.name,
        kind: 'province' as const,
        x: Math.min(width - reach, Math.max(reach, middle)),
        y: rows[i % 2] * TILE_SIZE,
      });
    });
}

// The drawn line for a route of road tiles (a site's tile, the road's
// tiles, the next site's tile), in pixels from its first tile to its last:
// the stretches of the network it runs along, joined and turned to face
// the way it goes. A route the network doesn't cover gives a straight line
// through its tiles' centers.
export function getRouteLine(ink: RealmInk, route: readonly Point[]): Point[] {
  const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
  const line: Point[] = [];
  let at = 0;
  while (at < route.length - 1) {
    const stretch = ink.roads.find(
      ({ tiles }) => matchesAt(route, at, tiles, same) || matchesAt(route, at, [...tiles].reverse(), same),
    );
    if (!stretch) {
      return route.map((p) => ({ x: p.x * TILE_SIZE + TILE_SIZE / 2, y: p.y * TILE_SIZE + TILE_SIZE / 2 }));
    }
    const forward = matchesAt(route, at, stretch.tiles, same);
    const points = forward ? stretch.line : [...stretch.line].reverse();
    line.push(...(line.length > 0 ? points.slice(1) : points));
    at += stretch.tiles.length - 1;
  }
  return line;
}

function matchesAt(
  route: readonly Point[],
  at: number,
  tiles: readonly Point[],
  same: (a: Point, b: Point) => boolean,
): boolean {
  if (tiles.length < 2 || at + tiles.length > route.length) return false;
  return tiles.every((tile, i) => same(tile, route[at + i]));
}

// The point `t` (0 to 1) of the way along `line` by length.
export function pointAlong(line: readonly Point[], t: number): Point {
  if (line.length === 0) return { x: 0, y: 0 };
  const lengths = line.slice(1).map((p, i) => Math.hypot(p.x - line[i].x, p.y - line[i].y));
  let left = Math.min(1, Math.max(0, t)) * lengths.reduce((sum, l) => sum + l, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] && lengths[i] > 0) {
      const f = left / lengths[i];
      return { x: line[i].x + (line[i + 1].x - line[i].x) * f, y: line[i].y + (line[i + 1].y - line[i].y) * f };
    }
    left -= lengths[i];
  }
  return { ...line[line.length - 1] };
}

// The realm's roads as one network, cut into chains of tiles (in tile
// coordinates) that run between sites, forks, dead ends and the tiles in
// `breaks` (where a river crosses), so road two routes share is drawn once. Tiles only join when a road steps from one
// to the other, never because two roads run side by side.
export function getRoadChains(realm: Realm, breaks: ReadonlySet<string> = new Set()): Point[][] {
  const key = (p: Point) => `${p.x},${p.y}`;
  const { links, points } = getRoadNetwork(realm);
  const sites = new Set(realm.sites.map(key));
  const isNode = (k: string) => sites.has(k) || breaks.has(k) || links.get(k)!.size !== 2;
  const walked = new Set<string>();
  const chains: Point[][] = [];
  const walk = (start: string, next: string) => {
    const chain = [points.get(start)!];
    let previous = start;
    let current = next;
    for (;;) {
      walked.add(`${previous}|${current}`).add(`${current}|${previous}`);
      chain.push(points.get(current)!);
      if (isNode(current)) break;
      const onward = [...links.get(current)!].find((k) => k !== previous);
      if (!onward || walked.has(`${current}|${onward}`)) break;
      previous = current;
      current = onward;
    }
    chains.push(chain);
  };
  const ordered = [...links.keys()].sort();
  for (const k of ordered)
    if (isNode(k)) for (const n of [...links.get(k)!].sort()) if (!walked.has(`${k}|${n}`)) walk(k, n);
  // Loops with no node on them.
  for (const k of ordered) for (const n of [...links.get(k)!].sort()) if (!walked.has(`${k}|${n}`)) walk(k, n);
  return chains;
}

// Ramer–Douglas–Peucker: drops the points of `points` that lie within
// `tolerance` of the straight line past them, so a staircase of tile steps
// becomes a slope. The ends stay put.
export function simplifyLine(points: readonly Point[], tolerance: number): Point[] {
  if (points.length < 3) return points.map(({ x, y }) => ({ x, y }));
  const first = points[0];
  const last = points[points.length - 1];
  const length = Math.hypot(last.x - first.x, last.y - first.y);
  let farthest = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const distance =
      length === 0
        ? Math.hypot(p.x - first.x, p.y - first.y)
        : Math.abs((last.x - first.x) * (first.y - p.y) - (first.x - p.x) * (last.y - first.y)) / length;
    if (distance > farthest) {
      farthest = distance;
      index = i;
    }
  }
  if (farthest <= tolerance) return [{ ...first }, { ...last }];
  return [
    ...simplifyLine(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplifyLine(points.slice(index), tolerance),
  ];
}

// Splits each stretch of `points` into steps of a few tiles and nudges
// the points between sideways by up to `amount` tiles, by a hash of where
// they are (so the same ground always wobbles the same way). The ends stay
// put.
export function wobbleLine(points: readonly Point[], seed: number, amount: number): Point[] {
  const line: Point[] = [{ ...points[0] }];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(length / 2.5));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      if (s === steps) {
        line.push({ ...b });
        continue;
      }
      const push = (hashCell(seed, Math.round(x * 4), Math.round(y * 4), 99) - 0.5) * 2 * amount;
      line.push({ x: x + (-(b.y - a.y) / length) * push, y: y + ((b.x - a.x) / length) * push });
    }
  }
  return line;
}

// Chaikin's corner cutting, `passes` times: each corner of `points` is cut
// to two points a quarter of the way along its sides, so a road of tile
// steps becomes a smooth curve through the same ground. The ends stay put.
export function smoothLine(points: readonly Point[], passes: number): Point[] {
  let line = points.map(({ x, y }) => ({ x, y }));
  for (let pass = 0; pass < passes && line.length > 2; pass++) {
    const next: Point[] = [line[0]];
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      if (i > 0) next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      if (i < line.length - 2) next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    next.push(line[line.length - 1]);
    line = next;
  }
  return line;
}

// The connected patches (4-way) of `terrain` on `realm`, biggest first,
// each as its cells.
export function findPatches(realm: Realm, terrain: RealmTerrain): Point[][] {
  const { grid } = realm;
  const seen = new Set<number>();
  const patches: Point[][] = [];
  for (const start of grid.cells) {
    const index = start.y * grid.width + start.x;
    if (seen.has(index) || start.terrain !== terrain) continue;
    seen.add(index);
    const patch: Point[] = [{ x: start.x, y: start.y }];
    for (let i = 0; i < patch.length; i++) {
      const { x, y } = patch[i];
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
        const next = ny * grid.width + nx;
        if (seen.has(next) || grid.cells[next].terrain !== terrain) continue;
        seen.add(next);
        patch.push({ x: nx, y: ny });
      }
    }
    patches.push(patch);
  }
  return patches.sort((a, b) => b.length - a.length);
}

const FEATURE_PREFIXES = [
  'Amber',
  'Bleak',
  'Cinder',
  'Dusk',
  'Ember',
  'Frost',
  'Gall',
  'Harrow',
  'Mourn',
  'Night',
  'Old',
  'Pale',
  'Silver',
  'Sorrow',
  'Storm',
  'Umber',
  'Weeping',
  'Whisper',
];
const FEATURE_PATTERNS: Readonly<Record<Exclude<InkLabelKind, 'province'>, readonly ((prefix: string) => string)[]>> = {
  water: [(p) => `Lake ${p}`, (p) => `${p}mere`, (p) => `The ${p} Water`],
  forest: [(p) => `${p}wood`, (p) => `The ${p} Wood`, (p) => `${p} Forest`],
  mountain: [(p) => `The ${p} Peaks`, (p) => `${p} Spine`, (p) => `${p} Heights`],
};
// A lake that runs along the map's edge is a sea.
const SEA_PATTERNS: readonly ((prefix: string) => string)[] = [(p) => `The ${p} Sea`, (p) => `The Sea of ${p}`];

// Names for the realm's biggest lakes, woods and ranges, placed on each
// patch's middle cell nearest its center (so a C-shaped lake's name sits on
// the lake) and clear of the names already `placed` (the provinces'),
// never twice the same name; the placed names come first in the result.
function nameFeatures(realm: Realm, placed: readonly InkLabel[] = []): InkLabel[] {
  const rng: Rng = createSeededRng((realm.seed ^ 0x696e6b) >>> 0);
  const taken = new Set(realm.sites.map((site) => site.name));
  const width = realm.grid.width * TILE_SIZE;
  const labels: InkLabel[] = [...placed];
  for (const kind of ['water', 'forest', 'mountain'] as const) {
    const patches = findPatches(realm, kind)
      .filter((patch) => patch.length >= INK_RULES.minNamed[kind])
      .slice(0, INK_RULES.maxNamed);
    for (const patch of patches) {
      const edgeCells = patch.filter((cell) => cell.y === 0 || cell.y === realm.grid.height - 1).length;
      const patterns = kind === 'water' && edgeCells >= INK_RULES.seaCells ? SEA_PATTERNS : FEATURE_PATTERNS[kind];
      let text = '';
      for (let attempt = 0; attempt < 20 && (!text || taken.has(text)); attempt++)
        text = randomItem(rng, patterns)(randomItem(rng, FEATURE_PREFIXES));
      if (taken.has(text)) continue;
      taken.add(text);
      // Kept far enough from the map's sides that the whole name shows.
      const reach = Math.min(width / 2, (text.length * INK_RULES.letterWidth * TILE_SIZE) / 2 + TILE_SIZE / 2);
      const spot = pickLabelSpot(patch, reach / TILE_SIZE, realm.sites, labels);
      labels.push(
        Object.freeze({
          text,
          kind,
          x: Math.min(width - reach, Math.max(reach, spot.x * TILE_SIZE + TILE_SIZE / 2)),
          y: spot.y * TILE_SIZE + TILE_SIZE / 2,
        }),
      );
    }
  }
  return labels;
}

// The cell of `patch` to letter a name `reach` tiles either side of: one
// clear of the sites (whose icons stand about two tiles tall over their
// tile, with the name under it) and the names already placed, and of
// those the nearest the patch's center, so a C-shaped lake's name sits on
// the lake. When no cell is clear, the clearest.
function pickLabelSpot(
  patch: readonly Point[],
  reach: number,
  sites: readonly Point[],
  labels: readonly InkLabel[],
): Point {
  const cx = patch.reduce((sum, p) => sum + p.x, 0) / patch.length;
  const cy = patch.reduce((sum, p) => sum + p.y, 0) / patch.length;
  const others = labels.map((label) => ({
    x: (label.x - TILE_SIZE / 2) / TILE_SIZE,
    y: (label.y - TILE_SIZE / 2) / TILE_SIZE,
  }));
  const clearance = (p: Point) =>
    Math.min(
      1,
      ...sites.map((site) => Math.max(Math.abs(site.x - p.x) / (reach + 1.2), Math.abs(site.y - 0.5 - p.y) / 2)),
      ...others.map((other) => Math.max(Math.abs(other.x - p.x) / (reach * 2), Math.abs(other.y - p.y) / 1.2)),
    );
  const score = (p: Point) => clearance(p) * 100 - Math.hypot(p.x - cx, p.y - cy);
  return patch.reduce((best, p) => (score(p) > score(best) ? p : best));
}

// A number from 0 to 1 that only depends on its arguments: the dice for
// cell (x, y)'s `k`th choice on the map of `seed`.
export function hashCell(seed: number, x: number, y: number, k: number): number {
  let h = (seed ^ Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(y + 1, 0x165667b1) ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function pick<T>(roll: number, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(roll * items.length))];
}
