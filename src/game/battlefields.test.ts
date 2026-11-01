import { describe, expect, it } from 'vitest';
import {
  BATTLEFIELD_KINDS,
  BATTLEFIELD_LAYOUTS,
  BATTLEFIELD_OBSTACLES,
  BATTLEFIELD_SIZE,
  generateBattlefield,
  OBSTACLE_KINDS,
  OBSTACLE_TERRAIN,
  type BattlefieldKind,
} from './battlefields.ts';
import { getCell, type Point } from './grid.ts';
import { checkMap } from './mapCheck.ts';
import { generateMap } from './mapPlan.ts';
import { getMoveCost } from './movement.ts';
import { createSeededRng } from './rng.ts';

const key = ({ x, y }: Point) => `${x},${y}`;
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const field = (battlefield: BattlefieldKind, seed: number, obstacles: [number, number] = [8, 14]) =>
  generateBattlefield({ ...BATTLEFIELD_SIZE, battlefield, obstacles }, createSeededRng(seed));

describe('battlefield tables', () => {
  it('gives every obstacle a terrain and every battlefield obstacles of its own', () => {
    for (const obstacle of OBSTACLE_KINDS) expect(['mountain', 'forest']).toContain(OBSTACLE_TERRAIN[obstacle]);
    for (const kind of BATTLEFIELD_KINDS) {
      const { cache, cacheSides, grove, scatter } = BATTLEFIELD_LAYOUTS[kind];
      for (const obstacle of [...cache, ...cacheSides, ...grove, ...scatter]) {
        expect(BATTLEFIELD_OBSTACLES[kind]).toContain(obstacle);
      }
    }
    for (const kind of BATTLEFIELD_KINDS) expect(BATTLEFIELD_OBSTACLES[kind].length).toBeGreaterThan(0);
  });
});

describe('generateBattlefield', () => {
  it.each(BATTLEFIELD_KINDS)('scatters %s obstacles within the count, of its own kinds', (kind) => {
    for (const seed of SEEDS) {
      const { grid, obstacles } = field(kind, seed);
      expect(obstacles.length).toBeGreaterThanOrEqual(8);
      expect(obstacles.length).toBeLessThanOrEqual(14);
      for (const { x, y, obstacle } of obstacles) {
        expect(BATTLEFIELD_OBSTACLES[kind]).toContain(obstacle);
        expect(getCell(grid, x, y)!.terrain).toBe(OBSTACLE_TERRAIN[obstacle]);
      }
      const marked = new Set(obstacles.map(key));
      expect(grid.cells.filter((c) => !marked.has(key(c))).every((c) => c.terrain === 'grass')).toBe(true);
    }
  });

  it('keeps obstacles off and away from the deployment zone and off the seize tile', () => {
    for (const kind of BATTLEFIELD_KINDS) {
      for (const seed of SEEDS) {
        const { obstacles, deploymentZone, seizeTile } = field(kind, seed, [10, 14]);
        for (const a of obstacles) {
          expect(key(a)).not.toBe(key(seizeTile));
          for (const d of deploymentZone) expect(Math.max(Math.abs(a.x - d.x), Math.abs(a.y - d.y))).toBeGreaterThan(1);
        }
      }
    }
  });

  it('never walls a cell off', () => {
    for (const kind of BATTLEFIELD_KINDS) {
      for (const seed of SEEDS) {
        const { grid, obstacles, deploymentZone } = field(kind, seed, [14, 20]);
        const open = grid.cells.filter((c) => getMoveCost(c.terrain) < Infinity);
        expect(checkMap({ grid, buildings: [], deploymentZone, enemyTiles: open })).toEqual([]);
        expect(obstacles.length).toBeGreaterThan(0);
      }
    }
  });

  it('runs a fence along a row of the plains, broken in at least one place', () => {
    let fenced = 0;
    for (const seed of SEEDS) {
      const { obstacles } = field('plains', seed);
      const fence = obstacles.filter(({ obstacle }) => obstacle === 'fence' || obstacle === 'brokenFence');
      if (fence.length === 0) continue;
      fenced++;
      expect(fence.length).toBeGreaterThanOrEqual(3);
      expect(new Set(fence.map(({ y }) => y)).size).toBe(1);
      const xs = fence.map(({ x }) => x).sort((a, b) => a - b);
      expect(xs.at(-1)! - xs[0]).toBe(xs.length - 1);
      expect(fence.some(({ obstacle }) => obstacle === 'brokenFence')).toBe(true);
    }
    expect(fenced).toBeGreaterThan(SEEDS.length * 0.7);
  });

  it('stacks a cache of supplies in the middle of the field', () => {
    for (const kind of BATTLEFIELD_KINDS) {
      let cached = 0;
      for (const seed of SEEDS) {
        const { obstacles } = field(kind, seed);
        const anchors = obstacles.filter(({ obstacle }) => BATTLEFIELD_LAYOUTS[kind].cache.includes(obstacle));
        const stacked = anchors.find((a) => obstacles.some((b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1));
        if (stacked) cached++;
      }
      expect(cached).toBeGreaterThan(SEEDS.length * 0.7);
    }
  });

  it('sets out more set pieces on a bigger field', () => {
    let more = 0;
    for (const seed of SEEDS) {
      const big = generateBattlefield(
        { width: 24, height: 16, battlefield: 'plains', obstacles: [30, 30] },
        createSeededRng(seed),
      );
      const small = field('plains', seed, [30, 30]);
      const carts = (obstacles: { obstacle: string }[]) =>
        obstacles.filter(({ obstacle }) => BATTLEFIELD_LAYOUTS.plains.cache.includes(obstacle as never)).length;
      if (carts(big.obstacles) > carts(small.obstacles)) more++;
      const open = big.grid.cells.filter((c) => getMoveCost(c.terrain) < Infinity);
      expect(checkMap({ grid: big.grid, buildings: [], deploymentZone: big.deploymentZone, enemyTiles: open })).toEqual(
        [],
      );
    }
    expect(more).toBeGreaterThan(SEEDS.length * 0.5);
  });

  it('never blocks the road', () => {
    for (const seed of SEEDS) {
      const { grid, path } = field('desert', seed, [10, 14]);
      for (const { x, y } of path) expect(getMoveCost(getCell(grid, x, y)!.terrain)).toBeLessThan(Infinity);
    }
  });

  it('deploys down the west edge and keeps every tile walkable from there', () => {
    for (const kind of BATTLEFIELD_KINDS) {
      for (const seed of SEEDS) {
        const { grid, deploymentZone, enemyZones } = field(kind, seed);
        expect(deploymentZone.every(({ x }) => x === 0)).toBe(true);
        expect(enemyZones.flat().every(({ x }) => x >= BATTLEFIELD_SIZE.width / 2)).toBe(true);
        expect(checkMap({ grid, buildings: [], deploymentZone, enemyTiles: [] })).toEqual([]);
      }
    }
  });

  it('is the same from the same seed', () => {
    expect(field('plains', 4)).toEqual(field('plains', 4));
  });
});

describe('generateMap with the battlefield generator', () => {
  it('builds the battlefield its options name, whatever the archetype', () => {
    const map = generateMap(
      {
        width: 10,
        height: 6,
        generator: 'battlefield',
        battlefield: 'desert',
        obstacles: [5, 5],
        archetype: 'islands',
      },
      createSeededRng(2),
    );
    expect(map.obstacles).toHaveLength(5);
    expect(map.buildings).toEqual([]);
    expect(map.obstacles!.every(({ obstacle }) => BATTLEFIELD_OBSTACLES.desert.includes(obstacle))).toBe(true);
  });
});
