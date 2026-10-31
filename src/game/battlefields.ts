// Battlefields: the side view's maps, after Heroes of Might and Magic III's
// battles. Each kind (plains, forest, desert) is one open field with its
// own look (floor and backdrop, see backdrop.ts), and a battle scatters a
// handful of obstacles over it, each standing on one cell and giving that
// cell its rule: a rock or cactus blocks the way, a bush or tree slows it.
// The two sides face each other across it as on an arena (planArena in
// mapArchetypes.ts): the player down the west edge, the enemy in the east
// half, and the arena's road and second route (not drawn) are kept clear
// of anything that blocks, so every fight can be walked. Pure: the same
// options and Rng always give the same field.

import type { Rng } from './combatStats.ts';
import { createGrid, setTerrain, type Grid, type Point } from './grid.ts';
import { planArena, rect } from './mapArchetypes.ts';
import { getMoveCost } from './movement.ts';
import { randomInt, randomItem, shuffle } from './rng.ts';

export const BATTLEFIELD_KINDS = ['plains', 'forest', 'desert'] as const;
export type BattlefieldKind = (typeof BATTLEFIELD_KINDS)[number];

export const OBSTACLE_KINDS = ['rock', 'boulder', 'bush', 'pine', 'thicket', 'crag', 'cactus'] as const;
export type ObstacleKind = (typeof OBSTACLE_KINDS)[number];

// The terrain each obstacle gives its cell, which sets its rules
// (movement.ts and the rest read terrain): mountain blocks, forest slows.
export const OBSTACLE_TERRAIN: Readonly<Record<ObstacleKind, 'mountain' | 'forest'>> = Object.freeze({
  rock: 'mountain',
  boulder: 'mountain',
  bush: 'forest',
  pine: 'forest',
  thicket: 'forest',
  crag: 'mountain',
  cactus: 'mountain',
});

// The obstacles each battlefield scatters, picked evenly (list one twice
// to make it twice as common).
export const BATTLEFIELD_OBSTACLES: Readonly<Record<BattlefieldKind, readonly ObstacleKind[]>> = Object.freeze({
  plains: ['rock', 'boulder', 'bush', 'bush', 'thicket'],
  forest: ['pine', 'pine', 'thicket', 'bush', 'rock'],
  desert: ['rock', 'boulder', 'crag', 'cactus', 'cactus'],
});

// The size every battlefield is fought on, in cells: the open field the
// painted battlefields (src/assets/battlefieldArt.ts) leave clear.
export const BATTLEFIELD_SIZE = Object.freeze({ width: 14, height: 10 });

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

// Lays out a battlefield: the arena's plan for where each side stands,
// then up to options.obstacles obstacles of the battlefield's kinds on
// random free cells. Nothing goes on or next to the deployment zone, on
// the seize tile, or touching another obstacle (so they never wall a
// stretch off), and nothing that blocks goes on the road or second route.
export function generateBattlefield(options: BattlefieldOptions, rng: Rng): Battlefield {
  const { width, height, battlefield } = options;
  const plan = planArena(width, height, rng);
  const near = (tiles: readonly Point[]) => tiles.flatMap(({ x, y }) => rect(x - 1, y - 1, x + 1, y + 1));
  const reserved = new Set([...near(plan.deploymentZone), plan.seizeTile!].map(key));
  const routes = new Set([...plan.path, ...plan.routes.flat()].map(key));

  let grid = createGrid(width, height, 'grass');
  const obstacles: ObstaclePlacement[] = [];
  const taken = new Set<string>();
  const count = randomInt(rng, options.obstacles[0], options.obstacles[1]);
  for (const cell of shuffle(rng, grid.cells)) {
    if (obstacles.length >= count) break;
    if (reserved.has(key(cell)) || taken.has(key(cell))) continue;
    const kinds = BATTLEFIELD_OBSTACLES[battlefield].filter(
      (kind) => !routes.has(key(cell)) || getMoveCost(OBSTACLE_TERRAIN[kind]) < Infinity,
    );
    if (kinds.length === 0) continue;
    const obstacle = randomItem(rng, kinds);
    obstacles.push({ x: cell.x, y: cell.y, obstacle });
    near([cell]).forEach((p) => taken.add(key(p)));
    grid = setTerrain(grid, cell.x, cell.y, OBSTACLE_TERRAIN[obstacle]);
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
