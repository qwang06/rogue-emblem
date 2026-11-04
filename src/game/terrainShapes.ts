// Natural shapes for the generator's terrain (mapGen.ts), after the way
// roguelikes like Brogue shape lakes and caves: patches that grow into
// rounded clumps or long ridges instead of random scribbles, a cellular
// automaton pass that fills the notches and holes they leave, and cave
// walls grown by the same automaton. Pure: the same grid and rng always
// give the same result.

import type { Rng } from './combatStats.ts';
import { getCell, getNeighbors, setTerrain, type Grid, type Point } from './grid.ts';
import { getMoveCost } from './movement.ts';
import { weightedShuffle } from './rng.ts';

const key = ({ x, y }: Point) => `${x},${y}`;

// How a patch grows: a `blob` into a rounded clump; a `ridge` along a
// line west to east or north to south, a tile or two thick.
export type PatchShape = 'blob' | 'ridge';

// The 8 tiles around `p` (diagonals included), on the map or not.
function getRing({ x, y }: Point): Point[] {
  const ring: Point[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) if (dx !== 0 || dy !== 0) ring.push({ x: x + dx, y: y + dy });
  }
  return ring;
}

// How much more a ridge favors a tile on its line than one beside it
// (anything farther off is a long shot).
const RIDGE_PULL = [24, 1];
const RIDGE_STRAY = 0.05;

// Grows a patch of `terrain` of up to `size` tiles from `start`, over grass
// tiles not in `blocked`, one tile at a time. Each step picks a grass
// neighbor of the patch so far: a blob weighted toward the tiles it
// already wraps most (so it stays a clump with few spurs), a ridge toward
// its line through `start` (west to east or north to south, half the time
// each), then the rows beside it (RIDGE_PULL). Returns the grid
// with the patch's tiles changed (unchanged if `start` itself is blocked
// or not grass).
export function growShapedPatch(
  grid: Grid,
  start: Point,
  size: number,
  rng: Rng,
  blocked: ReadonlySet<string>,
  terrain: string,
  shape: PatchShape = 'blob',
): Grid {
  const inPatch = new Set<string>();
  const canGrow = (p: Point) =>
    !blocked.has(key(p)) && !inPatch.has(key(p)) && getCell(grid, p.x, p.y)?.terrain === 'grass';
  if (!canGrow(start)) return grid;

  const across = shape === 'ridge' && rng() < 0.5;
  const offLine = (p: Point) => (across ? Math.abs(p.y - start.y) : Math.abs(p.x - start.x));
  const weight = (p: Point) => {
    if (shape === 'ridge') return RIDGE_PULL[offLine(p)] ?? RIDGE_STRAY;
    const wrapped = getRing(p).filter((n) => inPatch.has(key(n))).length;
    return 1 + wrapped * wrapped;
  };

  const patch = [start];
  inPatch.add(key(start));
  while (patch.length < size) {
    const frontier = new Map<string, Point>();
    for (const p of patch) {
      for (const n of getNeighbors(grid, p.x, p.y)) if (canGrow(n)) frontier.set(key(n), n);
    }
    if (frontier.size === 0) break;
    const [next] = weightedShuffle(rng, [...frontier.values()], weight);
    patch.push(next);
    inPatch.add(key(next));
  }
  return patch.reduce((g, p) => setTerrain(g, p.x, p.y, terrain), grid);
}

// One pass of a cellular automaton that rounds off `terrains`: every
// grass tile with at least FILL_NEIGHBORS of its 8 neighbors of one of
// them turns into it (filling notches and one-tile holes), when
// `canFill(tile, terrain)` allows. Every tile is judged on the grid as it
// was before the pass.
export const FILL_NEIGHBORS = 5;
export function smoothPatches(
  grid: Grid,
  terrains: readonly string[],
  canFill: (tile: Point, terrain: string) => boolean,
): Grid {
  let next = grid;
  for (const cell of grid.cells) {
    if (cell.terrain !== 'grass') continue;
    const around = getRing(cell).map((p) => getCell(grid, p.x, p.y)?.terrain);
    const terrain = terrains.find((t) => around.filter((a) => a === t).length >= FILL_NEIGHBORS && canFill(cell, t));
    if (terrain) next = setTerrain(next, cell.x, cell.y, terrain);
  }
  return next;
}

// How cave walls grow: the share of open tiles seeded with rock, and how
// many rounds of the automaton smooth them.
export const CAVE_FILL = 0.5;
export const CAVE_STEPS = 4;

// Cave walls of `rock` grown over the map's grass, the classic
// cellular-automaton way: seed each grass tile with rock at `fill` odds,
// then `steps` times over, a grass tile is rock when 5 or more of its 8
// neighbors are, or it already is and 4 are. Off the map counts as rock (so
// the walls hug the map's sides) and anything but grass as open (so the
// walls give the road and buildings room). Tiles in `blocked` take part in
// the automaton but are left open at the end, so the walls keep their
// shape and simply stop short of them.
export function growCaveWalls(
  grid: Grid,
  rng: Rng,
  blocked: ReadonlySet<string>,
  rock = 'mountain',
  fill = CAVE_FILL,
  steps = CAVE_STEPS,
): Grid {
  const ground = grid.cells.filter((c) => c.terrain === 'grass');
  let walls = new Set(ground.filter(() => rng() < fill).map(key));
  for (let i = 0; i < steps; i++) {
    const was = walls;
    const isRock = (p: Point) => !getCell(grid, p.x, p.y) || was.has(key(p));
    walls = new Set(
      ground
        .filter((c) => {
          const n = getRing(c).filter(isRock).length;
          return n >= 5 || (n >= 4 && was.has(key(c)));
        })
        .map(key),
    );
  }
  return ground
    .filter((c) => walls.has(key(c)) && !blocked.has(key(c)))
    .reduce((g, c) => setTerrain(g, c.x, c.y, rock), grid);
}

// `grid` with every pocket of open ground walled off from `from` (a group
// of grass, meadow or forest tiles that touch each other but no other
// walkable tile, none of them in `keep`) filled with `rock`, so caves
// leave no ground nobody can reach.
const FILLABLE: readonly (string | null)[] = ['grass', 'meadow', 'forest'];
export function fillPockets(grid: Grid, from: Point, keep: ReadonlySet<string>, rock = 'mountain'): Grid {
  const isOpen = (p: Point) => {
    const cell = getCell(grid, p.x, p.y);
    return !!cell && Number.isFinite(getMoveCost(cell.terrain));
  };
  const seen = new Set<string>();
  const flood = (start: Point): Point[] => {
    const group = [start];
    seen.add(key(start));
    for (let i = 0; i < group.length; i++) {
      for (const n of getNeighbors(grid, group[i].x, group[i].y)) {
        if (!seen.has(key(n)) && isOpen(n)) {
          seen.add(key(n));
          group.push(n);
        }
      }
    }
    return group;
  };
  if (isOpen(from)) flood(from);
  let next = grid;
  for (const cell of grid.cells) {
    if (seen.has(key(cell)) || !isOpen(cell)) continue;
    const pocket = flood(cell);
    const fillable = pocket.every((p) => FILLABLE.includes(getCell(grid, p.x, p.y)!.terrain) && !keep.has(key(p)));
    if (fillable) next = pocket.reduce((g, p) => setTerrain(g, p.x, p.y, rock), next);
  }
  return next;
}
