// Battlefields: the side view's maps, after Heroes of Might and Magic III's
// battles. Each kind (plains, forest, desert) is one open field with its
// own look (its painted kit, see battlefieldKits.ts), and a battle sets
// obstacles out over it, natural ones and props, each standing on one cell
// and giving that cell its rule: a rock, a fence or a cart blocks the way,
// a bush or a stump slows it. They go down as set pieces (a fence line, a
// stack of supplies, a grove) that shape the fight, then a scatter.
// The two sides face each other across it as on an arena (planArena in
// mapArchetypes.ts): the player down the west edge, the enemy in the east
// half, and the arena's road and second route (not drawn) are kept clear
// of anything that blocks, so every fight can be walked. Pure: the same
// options and Rng always give the same field.

import type { Rng } from './combatStats.ts';
import { createGrid, getCell, setTerrain, type Grid, type Point } from './grid.ts';
import { planArena, rect } from './mapArchetypes.ts';
import { getMoveCost } from './movement.ts';
import { randomInt, randomItem, shuffle } from './rng.ts';

export const BATTLEFIELD_KINDS = ['plains', 'forest', 'desert'] as const;
export type BattlefieldKind = (typeof BATTLEFIELD_KINDS)[number];

// Natural obstacles (rocks and plants) and props (things people left
// on the field: fences, a cart, supplies), both painted (PAINTED_OBSTACLES
// in tileset.ts), each standing on one cell.
export const NATURAL_OBSTACLES = ['rock', 'boulder', 'bush', 'pine', 'thicket', 'crag', 'cactus'] as const;
export type NaturalObstacle = (typeof NATURAL_OBSTACLES)[number];
export const PROP_OBSTACLES = [
  'fence',
  'brokenFence',
  'barrels',
  'crates',
  'cart',
  'wheel',
  'sack',
  'stump',
  'signpost',
] as const;
export const OBSTACLE_KINDS = [...NATURAL_OBSTACLES, ...PROP_OBSTACLES] as const;
export type ObstacleKind = (typeof OBSTACLE_KINDS)[number];

// The terrain each obstacle gives its cell, which sets its rules
// (movement.ts and the rest read terrain): mountain blocks, forest slows.
// The big things (rocks, a fence, a cart, stacked crates and barrels) block;
// what can be clambered over or pushed through (plants, a broken fence, a
// stump, a sack, a fallen wheel, a signpost) slows.
export const OBSTACLE_TERRAIN: Readonly<Record<ObstacleKind, 'mountain' | 'forest'>> = Object.freeze({
  rock: 'mountain',
  boulder: 'mountain',
  bush: 'forest',
  pine: 'forest',
  thicket: 'forest',
  crag: 'mountain',
  cactus: 'mountain',
  fence: 'mountain',
  brokenFence: 'forest',
  barrels: 'mountain',
  crates: 'mountain',
  cart: 'mountain',
  wheel: 'forest',
  sack: 'forest',
  stump: 'forest',
  signpost: 'forest',
});

// How a battlefield sets its obstacles out, as set pieces that make
// something of the ground before the rest are scattered:
// - fence: a fence run along a row through the middle of the field, with a
//   broken stretch (passable, slow) in it, splitting the fight into lanes
// - cache: a stack of supplies (a cart or crates) with more beside it, cover
//   in no-man's-land that both sides close on
// - groves: clumps of two or three of its plants and rocks
// - scatter: the rest, on their own cells apart from everything
// Each list is picked from evenly (list one twice to make it twice as
// common); an empty one leaves its set piece out.
export interface BattlefieldLayout {
  fences: number;
  cache: readonly ObstacleKind[];
  cacheSides: readonly ObstacleKind[];
  groves: number;
  grove: readonly ObstacleKind[];
  scatter: readonly ObstacleKind[];
}

export const BATTLEFIELD_LAYOUTS: Readonly<Record<BattlefieldKind, BattlefieldLayout>> = Object.freeze({
  // Farmland: a field fence, a farm cart with its load, hedges and stones.
  plains: {
    fences: 1,
    cache: ['cart', 'crates'],
    cacheSides: ['crates', 'barrels', 'sack', 'wheel'],
    groves: 1,
    grove: ['bush', 'bush', 'thicket', 'rock', 'boulder'],
    scatter: ['rock', 'boulder', 'bush', 'bush', 'thicket', 'stump', 'signpost'],
  },
  // A woodcutters' clearing: stumps and a cart of logs among pine groves.
  forest: {
    fences: 0,
    cache: ['cart', 'crates'],
    cacheSides: ['stump', 'sack', 'barrels'],
    groves: 2,
    grove: ['pine', 'pine', 'thicket', 'bush'],
    scatter: ['pine', 'pine', 'thicket', 'bush', 'stump', 'rock'],
  },
  // A broken-down caravan among the rocks.
  desert: {
    fences: 0,
    cache: ['cart', 'barrels'],
    cacheSides: ['crates', 'barrels', 'sack', 'wheel'],
    groves: 2,
    grove: ['rock', 'boulder', 'crag', 'cactus'],
    scatter: ['rock', 'boulder', 'crag', 'cactus', 'cactus'],
  },
});

// Every obstacle a battlefield's layout can put down.
function layoutObstacles(layout: BattlefieldLayout): readonly ObstacleKind[] {
  const fences: ObstacleKind[] = layout.fences > 0 ? ['fence', 'brokenFence'] : [];
  return [...new Set([...fences, ...layout.cache, ...layout.cacheSides, ...layout.grove, ...layout.scatter])];
}

export const BATTLEFIELD_OBSTACLES: Readonly<Record<BattlefieldKind, readonly ObstacleKind[]>> = Object.freeze({
  plains: layoutObstacles(BATTLEFIELD_LAYOUTS.plains),
  forest: layoutObstacles(BATTLEFIELD_LAYOUTS.forest),
  desert: layoutObstacles(BATTLEFIELD_LAYOUTS.desert),
});

// The size every battlefield is fought on, in cells: the open field the
// painted battlefields (src/assets/battlefieldArt.ts) leave clear.
export const BATTLEFIELD_SIZE = Object.freeze({ width: 14, height: 12 });

// The size every built-in Warband region is fought on, in cells: bigger
// than the screen shows at once, so the camera scrolls across it
// (SCROLL_VIEW_CELLS in camera.ts).
export const REGION_FIELD_SIZE = Object.freeze({ width: 24, height: 16 });

export interface ObstaclePlacement extends Point {
  obstacle: ObstacleKind;
}

export interface BattlefieldOptions {
  width: number;
  height: number;
  battlefield: BattlefieldKind;
  // How many obstacles to scatter, [min, max].
  obstacles: readonly [number, number];
}

export interface Battlefield {
  // Grass everywhere, but where an obstacle stands its terrain.
  grid: Grid;
  obstacles: ObstaclePlacement[];
  // The arena's road, kept clear but not drawn (see planArena).
  path: Point[];
  deploymentZone: Point[];
  enemyZones: Point[][];
  seizeTile: Point;
}

const key = ({ x, y }: Point) => `${x},${y}`;
const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

// Whether every cell of `grid` a unit can stand on can be walked to from
// `start`, so nothing is walled off.
function isConnected(grid: Grid, start: Point): boolean {
  const open = (p: Point) => {
    const cell = getCell(grid, p.x, p.y);
    return cell !== undefined && getMoveCost(cell.terrain) < Infinity;
  };
  const seen = new Set([key(start)]);
  const queue = [start];
  while (queue.length > 0) {
    const { x, y } = queue.pop()!;
    for (const [dx, dy] of STEPS) {
      const next = { x: x + dx, y: y + dy };
      if (!seen.has(key(next)) && open(next)) {
        seen.add(key(next));
        queue.push(next);
      }
    }
  }
  return grid.cells.filter(open).length === seen.size;
}

// Lays out a battlefield: the arena's plan for where each side stands, then
// options.obstacles (a count between [min, max]) of the battlefield's
// obstacles, set out as its layout's set pieces (BATTLEFIELD_LAYOUTS) and
// the rest scattered. Nothing goes on or next to the deployment zone or on
// the seize tile, nothing that blocks goes on the road or second route, a
// set piece never touches another or a scattered obstacle, and nothing is
// put down that would wall any cell off from the rest. A set piece that
// finds no room is left out.
export function generateBattlefield(options: BattlefieldOptions, rng: Rng): Battlefield {
  const { width, height, battlefield } = options;
  const layout = BATTLEFIELD_LAYOUTS[battlefield];
  const plan = planArena(width, height, rng);
  const near = (tiles: readonly Point[]) => tiles.flatMap(({ x, y }) => rect(x - 1, y - 1, x + 1, y + 1));
  const reserved = new Set([...near(plan.deploymentZone), plan.seizeTile!].map(key));
  const routes = new Set([...plan.path, ...plan.routes.flat()].map(key));
  const start = plan.deploymentZone[0];

  let grid = createGrid(width, height, 'grass');
  const obstacles: ObstaclePlacement[] = [];
  // Cells a new set piece or scattered obstacle may not take: every
  // obstacle and the ring around it.
  const taken = new Set<string>();
  const count = randomInt(rng, options.obstacles[0], options.obstacles[1]);
  const inside = ({ x, y }: Point) => x >= 0 && y >= 0 && x < width && y < height;

  // Puts `piece` down if it fits: within the count, every cell free and
  // not a blocker on a route, and nothing walled off. True if it did.
  const tryPlace = (piece: readonly ObstaclePlacement[]) => {
    if (piece.length === 0 || obstacles.length + piece.length > count) return false;
    for (const cell of piece) {
      if (!inside(cell) || reserved.has(key(cell)) || taken.has(key(cell))) return false;
      if (routes.has(key(cell)) && getMoveCost(OBSTACLE_TERRAIN[cell.obstacle]) === Infinity) return false;
    }
    let next = grid;
    for (const { x, y, obstacle } of piece) next = setTerrain(next, x, y, OBSTACLE_TERRAIN[obstacle]);
    // Only a piece with a blocker in it can wall anything off.
    const blocks = piece.some(({ obstacle }) => getMoveCost(OBSTACLE_TERRAIN[obstacle]) === Infinity);
    if (blocks && !isConnected(next, start)) return false;
    grid = next;
    obstacles.push(...piece);
    near(piece).forEach((p) => taken.add(key(p)));
    return true;
  };
  // A few tries at a set piece built around random anchors.
  const tryPiece = (build: () => ObstaclePlacement[]) => {
    for (let attempt = 0; attempt < 12; attempt++) if (tryPlace(build())) return;
  };
  // A field bigger than BATTLEFIELD_SIZE gets its layout's set pieces
  // again for every BATTLEFIELD_SIZE of ground it covers.
  const repeats = Math.max(1, Math.round((width * height) / (BATTLEFIELD_SIZE.width * BATTLEFIELD_SIZE.height)));
  const middle = (low: number, high: number) => randomInt(rng, Math.floor(width * low), Math.ceil(width * high) - 1);

  // Fences: three to five cells along a row away from the top and bottom
  // edges, in the middle of the field, one of them broken. Where the run
  // crosses a route it's broken there too, so the way stays open.
  for (let i = 0; i < layout.fences * repeats; i++) {
    tryPiece(() => {
      const length = randomInt(rng, 3, 5);
      const x0 = middle(0.25, 0.75) - Math.floor(length / 2);
      const y = randomInt(rng, 2, height - 3);
      const gap = randomInt(rng, 1, length - 2);
      return Array.from({ length }, (_, j) => {
        const cell = { x: x0 + j, y };
        const broken = j === gap || routes.has(key(cell));
        return { ...cell, obstacle: broken ? 'brokenFence' : 'fence' } as ObstaclePlacement;
      });
    });
  }

  // The cache: a cart or crates in no-man's-land, two or three more things
  // stacked against its sides (one per repeat).
  for (let i = 0; layout.cache.length > 0 && i < repeats; i++) {
    tryPiece(() => {
      const anchor = { x: middle(0.35, 0.75), y: randomInt(rng, 1, height - 2) };
      const sides = shuffle(rng, STEPS)
        .slice(0, randomInt(rng, 2, 3))
        .map(([dx, dy]) => ({ x: anchor.x + dx, y: anchor.y + dy, obstacle: randomItem(rng, layout.cacheSides) }));
      return [{ ...anchor, obstacle: randomItem(rng, layout.cache) }, ...sides];
    });
  }

  // Groves: two or three plants or rocks, side by side.
  for (let i = 0; i < layout.groves * repeats; i++) {
    tryPiece(() => {
      const anchor = { x: middle(0.2, 1), y: randomInt(rng, 0, height - 1) };
      const cells = [anchor, ...shuffle(rng, STEPS).map(([dx, dy]) => ({ x: anchor.x + dx, y: anchor.y + dy }))];
      return cells.slice(0, randomInt(rng, 2, 3)).map((cell) => ({ ...cell, obstacle: randomItem(rng, layout.grove) }));
    });
  }

  // The rest, one to a cell, apart from everything.
  for (const cell of shuffle(rng, grid.cells)) {
    if (obstacles.length >= count) break;
    const kinds = layout.scatter.filter(
      (kind) => !routes.has(key(cell)) || getMoveCost(OBSTACLE_TERRAIN[kind]) < Infinity,
    );
    if (kinds.length === 0) continue;
    tryPlace([{ x: cell.x, y: cell.y, obstacle: randomItem(rng, kinds) }]);
  }

  return {
    grid,
    obstacles,
    path: plan.path,
    deploymentZone: plan.deploymentZone,
    enemyZones: plan.enemyZones,
    seizeTile: plan.seizeTile!,
  };
}
