// Procedural terrain: builds a grass field with a winding dirt path from the
// south edge to the north edge, then dresses it with buildings, a walled
// ruin, lakes, mountains, forests and meadows, all from a seeded Rng. Pure:
// the same options and seed always give the same map.
//
// The generator works in layers, each one a small function:
//   1. carvePath      — a one-tile-wide dirt path, south edge to north edge
//   2. placeCastle    — a castle beside the path near the north edge
//   3. placeRuin      — a ring of wall with a gap, a building inside
//   4. placeBuildings — a few lone buildings on open grass
//   5. growPatch      — blobs of water, mountain, forest and meadow
//   6. getReachable   — which tiles can be walked to from the south end
// The path is laid first and nothing impassable (water, mountains, walls)
// goes on it or next to it, so the two ends of the map are always
// connected. Buildings stand on grass and keep a tile of open ground around
// them, so no patch crowds them or covers the tile their art overhangs.

import type { BuildingKind, BuildingPlacement } from './buildings.ts';
import type { Rng } from './combatStats.ts';
import { createGrid, getCell, getNeighbors, setTerrain, type Grid, type Point } from './grid.ts';
import { getMoveCost } from './movement.ts';
import { randomInt, randomItem, shuffle } from './rng.ts';
import { DEFAULT_TERRAIN_LEGEND } from './terrainMap.ts';

type Range = readonly [number, number];

export interface MapGenOptions {
  width: number;
  height: number;
  // How many patches of each terrain to try to grow (some may not fit),
  // and their size range in tiles.
  lakes?: number;
  lakeSize?: Range;
  mountains?: number;
  mountainSize?: Range;
  forests?: number;
  forestSize?: Range;
  meadows?: number;
  meadowSize?: Range;
  // Whether to try to put a castle beside the north end of the path.
  castle?: boolean;
  // How many walled ruins and lone buildings to try to place.
  ruins?: number;
  buildings?: number;
  // Chance (0–1) the path jogs sideways before moving up a row.
  turnChance?: number;
}

export interface GeneratedTerrain {
  grid: Grid;
  // The dirt path's tiles, from the south edge to the north edge.
  path: Point[];
  // Buildings on the map, each on a grass tile.
  buildings: BuildingPlacement[];
}

// What the lone buildings are picked from: everything but the castle, the
// ruin's buildings, and ones that need water.
export const FIELD_BUILDINGS: readonly BuildingKind[] = Object.freeze([
  'house',
  'farm',
  'windmill',
  'camp',
  'workshop',
  'fountain',
  'mine',
  'goldMine',
  'tower',
]);

// What stands inside a walled ruin.
export const RUIN_BUILDINGS: readonly BuildingKind[] = Object.freeze(['temple', 'fort']);

function key({ x, y }: Point): string {
  return `${x},${y}`;
}

function isGrass(grid: Grid, { x, y }: Point): boolean {
  return getCell(grid, x, y)?.terrain === 'grass';
}

// A one-tile-wide path from the middle of the bottom row to the top row.
// Each row it may jog 1–2 tiles sideways before stepping north, but never
// in two rows running: back-to-back jogs could put four path tiles in a
// 2x2 square, and the dirt autotile shows grass holes in anything wider than
// one tile.
export function carvePath(width: number, height: number, rng: Rng, turnChance = 0.35): Point[] {
  const path: Point[] = [];
  let x = Math.floor(width / 2);
  let jogged = false;
  for (let y = height - 1; y >= 0; y--) {
    path.push({ x, y });
    if (y === 0 || jogged || rng() >= turnChance) {
      jogged = false;
      continue;
    }
    const step = rng() < 0.5 ? -1 : 1;
    const target = Math.max(1, Math.min(width - 2, x + step * randomInt(rng, 1, 2)));
    while (x !== target) {
      x += Math.sign(target - x);
      path.push({ x, y });
    }
    jogged = true;
  }
  return path;
}

// Every tile within one step (including diagonals) of any of `tiles`, plus
// the tiles themselves, as keys.
function withMargin(tiles: readonly Point[]): Set<string> {
  const keys = new Set<string>();
  for (const { x, y } of tiles) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) keys.add(key({ x: x + dx, y: y + dy }));
    }
  }
  return keys;
}

// Grows a patch of `terrain` of up to `size` tiles from `start` by
// repeatedly turning a random grass neighbor of the patch so far, skipping
// `blocked` tiles. Returns the grid with the patch's tiles changed
// (unchanged if `start` itself is blocked or not grass).
export function growPatch(
  grid: Grid,
  start: Point,
  size: number,
  rng: Rng,
  blocked: ReadonlySet<string>,
  terrain: string,
): Grid {
  const patch: Point[] = [];
  const inPatch = new Set<string>();
  const canGrow = (p: Point) => !blocked.has(key(p)) && !inPatch.has(key(p)) && isGrass(grid, p);

  if (!canGrow(start)) return grid;
  patch.push(start);
  inPatch.add(key(start));
  while (patch.length < size) {
    const frontier = patch.flatMap((p) => getNeighbors(grid, p.x, p.y)).filter(canGrow);
    if (frontier.length === 0) break;
    const next = randomItem(rng, frontier);
    patch.push(next);
    inPatch.add(key(next));
  }
  return patch.reduce((g, p) => setTerrain(g, p.x, p.y, terrain), grid);
}

// The cells of a rectangular ring of wall `width` x `height` cells with its
// top-left at (x, y), leaving out `gap` (a doorway).
export function getRingCells(x: number, y: number, width: number, height: number, gap: Point): Point[] {
  const cells: Point[] = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const onEdge = dx === 0 || dy === 0 || dx === width - 1 || dy === height - 1;
      const cell = { x: x + dx, y: y + dy };
      if (onEdge && key(cell) !== key(gap)) cells.push(cell);
    }
  }
  return cells;
}

// A castle on a grass tile right beside the path, two or three rows from
// the north edge (its spire overhangs the tile above). Null if there's no
// such tile out of `blocked`.
export function placeCastle(
  grid: Grid,
  path: readonly Point[],
  rng: Rng,
  blocked: ReadonlySet<string>,
): BuildingPlacement | null {
  const candidates = path
    .filter(({ y }) => y >= 2 && y <= 3)
    .flatMap(({ x, y }) => [
      { x: x - 1, y },
      { x: x + 1, y },
    ])
    .filter((p) => isGrass(grid, p) && !blocked.has(key(p)));
  return candidates.length > 0 ? { ...randomItem(rng, candidates), building: 'castle' } : null;
}

// A walled ruin: a ring of wall 4–5 tiles wide and tall, one tile thick, with
// a doorway in its south side and a building (from RUIN_BUILDINGS) on a tile
// inside. It stays a tile in from the map's sides (the wall autotile carries
// terrain past the edge, so a wall along it would draw as a thick block).
// Tries up to `attempts` random spots where every tile of the ruin, and the
// doorstep south of the doorway, is grass and out of `blocked`. Returns the
// grid with the walls laid, the building and every tile the ruin covers, or
// null if it never fit.
export function placeRuin(
  grid: Grid,
  rng: Rng,
  blocked: ReadonlySet<string>,
  attempts = 30,
): { grid: Grid; building: BuildingPlacement; tiles: Point[] } | null {
  for (let i = 0; i < attempts; i++) {
    const width = randomInt(rng, 4, 5);
    const height = randomInt(rng, 4, 5);
    const x = randomInt(rng, 1, grid.width - width - 1);
    const y = randomInt(rng, 0, grid.height - height - 1);
    const tiles: Point[] = [];
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) tiles.push({ x: x + dx, y: y + dy });
    }
    const gap = { x: x + randomInt(rng, 1, width - 2), y: y + height - 1 };
    const doorstep = { x: gap.x, y: gap.y + 1 };
    if ([...tiles, doorstep].some((p) => !isGrass(grid, p) || blocked.has(key(p)))) continue;

    const walls = getRingCells(x, y, width, height, gap);
    const inside = { x: x + randomInt(rng, 1, width - 2), y: y + randomInt(rng, 1, height - 2) };
    return {
      grid: walls.reduce((g, p) => setTerrain(g, p.x, p.y, 'wall'), grid),
      building: { ...inside, building: randomItem(rng, RUIN_BUILDINGS) },
      tiles,
    };
  }
  return null;
}

// Up to `count` buildings (from FIELD_BUILDINGS) on random grass tiles out
// of `blocked`, at least two rows from the north edge so a tall building's
// top (and any flag) stays on the map, and never next to each other.
export function placeBuildings(grid: Grid, count: number, rng: Rng, blocked: ReadonlySet<string>): BuildingPlacement[] {
  const taken = new Set(blocked);
  const buildings: BuildingPlacement[] = [];
  for (const cell of shuffle(rng, grid.cells)) {
    if (buildings.length >= count) break;
    if (cell.y < 2 || cell.terrain !== 'grass' || taken.has(key(cell))) continue;
    buildings.push({ x: cell.x, y: cell.y, building: randomItem(rng, FIELD_BUILDINGS) });
    withMargin([cell]).forEach((k) => taken.add(k));
  }
  return buildings;
}

// Every tile a unit could walk to from `start` (ignoring units and
// movement range), as keys "x,y". Tiles with an infinite move cost block.
export function getReachable(grid: Grid, start: Point): Set<string> {
  const seen = new Set<string>();
  if (!Number.isFinite(getMoveCost(getCell(grid, start.x, start.y)?.terrain ?? null))) return seen;
  const queue = [start];
  seen.add(key(start));
  while (queue.length > 0) {
    const p = queue.shift()!;
    for (const n of getNeighbors(grid, p.x, p.y)) {
      if (seen.has(key(n)) || !Number.isFinite(getMoveCost(getCell(grid, n.x, n.y)!.terrain))) continue;
      seen.add(key(n));
      queue.push(n);
    }
  }
  return seen;
}

// Builds the map in layers (see the top of this file). Everything but the
// path stays out of the top row and the bottom two rows (where the player
// deploys). Water, mountains and the ruin's walls also keep a tile clear of
// the path; forests and meadows may run right up to it. Every building
// and the ruin keep a tile of open grass around them.
export function generateTerrain(options: MapGenOptions, rng: Rng): GeneratedTerrain {
  const {
    width,
    height,
    lakes = 2,
    lakeSize = [4, 8],
    mountains = 2,
    mountainSize = [3, 6],
    forests = 4,
    forestSize = [3, 6],
    meadows = 3,
    meadowSize = [4, 8],
    castle = true,
    ruins = 1,
    buildings: buildingCount = 2,
    turnChance = 0.35,
  } = options;
  if (width < 3 || height < 3) throw new Error('A generated map needs to be at least 3x3');

  let grid = createGrid(width, height, 'grass');
  const path = carvePath(width, height, rng, turnChance);
  grid = path.reduce((g, p) => setTerrain(g, p.x, p.y, 'dirt'), grid);

  // Tiles each layer keeps out of: `edges` (top row, bottom two rows) for
  // everything, plus the path's margin for anything impassable, plus every
  // structure's margin once it's placed.
  const edges = new Set<string>();
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 2, height - 1]) edges.add(key({ x, y }));
  }
  const structures = new Set<string>();
  const nearPath = withMargin(path);
  const union = (...sets: ReadonlySet<string>[]) => new Set(sets.flatMap((s) => [...s]));

  const buildings: BuildingPlacement[] = [];
  const addBuilding = (building: BuildingPlacement) => {
    buildings.push(building);
    withMargin([building]).forEach((k) => structures.add(k));
  };

  if (castle) {
    const placed = placeCastle(grid, path, rng, edges);
    if (placed) addBuilding(placed);
  }
  for (let i = 0; i < ruins; i++) {
    const ruin = placeRuin(grid, rng, union(edges, nearPath, structures));
    if (!ruin) break;
    grid = ruin.grid;
    withMargin(ruin.tiles).forEach((k) => structures.add(k));
    buildings.push(ruin.building);
  }
  placeBuildings(grid, buildingCount, rng, union(edges, structures)).forEach(addBuilding);

  const impassableBlocked = union(edges, nearPath, structures);
  const openBlocked = union(edges, structures);
  const layers: [string, number, Range, ReadonlySet<string>][] = [
    ['water', lakes, lakeSize, impassableBlocked],
    ['mountain', mountains, mountainSize, impassableBlocked],
    ['forest', forests, forestSize, openBlocked],
    ['meadow', meadows, meadowSize, openBlocked],
  ];
  // Each patch starts on a grass tile it's free to grow from, so asking for
  // `count` patches gives that many unless the map runs out of room (a patch
  // can still grow into an earlier one of its kind and merge with it).
  for (const [terrain, count, [min, max], blocked] of layers) {
    for (let i = 0; i < count; i++) {
      const starts = grid.cells.filter((c) => c.terrain === 'grass' && !blocked.has(key(c)));
      if (starts.length === 0) break;
      grid = growPatch(grid, randomItem(rng, starts), randomInt(rng, min, max), rng, blocked, terrain);
    }
  }

  return { grid, path, buildings };
}

// The grid as text rows, one character per tile, using the inverse of a
// terrain legend (see terrainMap.ts). Handy for printing a generated map.
export function terrainToRows(
  grid: Grid,
  chars: Readonly<Record<string, string>> = Object.fromEntries(
    Object.entries(DEFAULT_TERRAIN_LEGEND).map(([char, terrain]) => [terrain, char]),
  ),
): string[] {
  const rows: string[] = [];
  for (let y = 0; y < grid.height; y++) {
    let row = '';
    for (let x = 0; x < grid.width; x++) {
      const terrain = getCell(grid, x, y)!.terrain;
      row += (terrain !== null ? chars[terrain] : undefined) ?? '?';
    }
    rows.push(row);
  }
  return rows;
}
