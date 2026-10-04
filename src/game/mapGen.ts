// Procedural terrain: builds a grass field with a winding dirt path from the
// south edge to the north edge and a few lakes beside it, all from a seeded
// Rng. Pure: the same options and seed always give the same map.
//
// The generator works in layers, each one a small function:
//   1. carvePath    — a one-tile-wide dirt path, south edge to north edge
//   2. growLake     — blobs of water, kept a tile clear of the path
//   3. getReachable — which tiles can be walked to from the south end
// The path is laid first and lakes avoid it, so the two ends of the map are
// always connected.

import type { Rng } from './combatStats.ts';
import { createGrid, getCell, getNeighbors, setTerrain, type Grid, type Point } from './grid.ts';
import { getMoveCost } from './movement.ts';
import { randomInt, randomItem } from './rng.ts';

export interface MapGenOptions {
  width: number;
  height: number;
  // How many lakes to try to place. Some may not fit.
  lakes?: number;
  // Lake size range in tiles.
  lakeSize?: readonly [number, number];
  // Chance (0–1) the path jogs sideways before moving up a row.
  turnChance?: number;
}

export interface GeneratedTerrain {
  grid: Grid;
  // The dirt path's tiles, from the south edge to the north edge.
  path: Point[];
}

function key({ x, y }: Point): string {
  return `${x},${y}`;
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
function withMargin(grid: Grid, tiles: readonly Point[]): Set<string> {
  const keys = new Set<string>();
  for (const { x, y } of tiles) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) keys.add(key({ x: x + dx, y: y + dy }));
    }
  }
  return keys;
}

// Grows a lake of up to `size` tiles from `start` by repeatedly flooding a
// random grass neighbor of the lake so far, skipping `blocked` tiles.
// Returns the grid with the lake's tiles turned to water (unchanged if
// `start` itself is blocked or not grass).
export function growLake(grid: Grid, start: Point, size: number, rng: Rng, blocked: ReadonlySet<string>): Grid {
  const lake: Point[] = [];
  const inLake = new Set<string>();
  const canFlood = (p: Point) =>
    !blocked.has(key(p)) && !inLake.has(key(p)) && getCell(grid, p.x, p.y)?.terrain === 'grass';

  if (!canFlood(start)) return grid;
  lake.push(start);
  inLake.add(key(start));
  while (lake.length < size) {
    const frontier = lake.flatMap((p) => getNeighbors(grid, p.x, p.y)).filter(canFlood);
    if (frontier.length === 0) break;
    const next = randomItem(rng, frontier);
    lake.push(next);
    inLake.add(key(next));
  }
  return lake.reduce((g, p) => setTerrain(g, p.x, p.y, 'water'), grid);
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

// Builds the terrain: grass everywhere, the dirt path, then the lakes. Lakes
// keep a one-tile margin from the path and stay out of the bottom two rows
// (where the player deploys) and the top row.
export function generateTerrain(options: MapGenOptions, rng: Rng): GeneratedTerrain {
  const { width, height, lakes = 3, lakeSize = [4, 9], turnChance = 0.35 } = options;
  if (width < 3 || height < 3) throw new Error('A generated map needs to be at least 3x3');

  let grid = createGrid(width, height, 'grass');
  const path = carvePath(width, height, rng, turnChance);
  grid = path.reduce((g, p) => setTerrain(g, p.x, p.y, 'dirt'), grid);

  const blocked = withMargin(grid, path);
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 2, height - 1]) blocked.add(key({ x, y }));
  }
  for (let i = 0; i < lakes; i++) {
    const start = { x: randomInt(rng, 0, width - 1), y: randomInt(rng, 1, height - 3) };
    grid = growLake(grid, start, randomInt(rng, lakeSize[0], lakeSize[1]), rng, blocked);
  }

  return { grid, path };
}

// The grid as text rows, one character per tile, using the inverse of a
// terrain legend (see terrainMap.ts). Handy for printing a generated map.
export function terrainToRows(
  grid: Grid,
  chars: Readonly<Record<string, string>> = { grass: '.', water: '~', dirt: ',', wall: '#' },
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
