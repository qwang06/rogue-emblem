import { describe, expect, it } from 'vitest';
import {
  BATTLEFIELD_KINDS,
  BATTLEFIELD_OBSTACLES,
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
const field = (battlefield: BattlefieldKind, seed: number, obstacles: [number, number] = [4, 7]) =>
  generateBattlefield({ width: 10, height: 6, battlefield, obstacles }, createSeededRng(seed));

describe('battlefield tables', () => {
  it('gives every obstacle a terrain and every battlefield obstacles of its own', () => {
    for (const obstacle of OBSTACLE_KINDS) expect(['mountain', 'forest']).toContain(OBSTACLE_TERRAIN[obstacle]);
    for (const kind of BATTLEFIELD_KINDS) expect(BATTLEFIELD_OBSTACLES[kind].length).toBeGreaterThan(0);
  });
});

describe('generateBattlefield', () => {
  it.each(BATTLEFIELD_KINDS)('scatters %s obstacles within the count, of its own kinds', (kind) => {
    for (const seed of SEEDS) {
      const { grid, obstacles } = field(kind, seed);
      expect(obstacles.length).toBeGreaterThanOrEqual(4);
      expect(obstacles.length).toBeLessThanOrEqual(7);
      for (const { x, y, obstacle } of obstacles) {
        expect(BATTLEFIELD_OBSTACLES[kind]).toContain(obstacle);
        expect(getCell(grid, x, y)!.terrain).toBe(OBSTACLE_TERRAIN[obstacle]);
      }
      const marked = new Set(obstacles.map(key));
      expect(grid.cells.filter((c) => !marked.has(key(c))).every((c) => c.terrain === 'grass')).toBe(true);
    }
  });

  it('keeps obstacles off and away from the deployment zone, off the seize tile, and apart', () => {
    for (const seed of SEEDS) {
      const { obstacles, deploymentZone, seizeTile } = field('forest', seed, [10, 14]);
      for (const a of obstacles) {
        expect(key(a)).not.toBe(key(seizeTile));
        for (const d of deploymentZone) expect(Math.max(Math.abs(a.x - d.x), Math.abs(a.y - d.y))).toBeGreaterThan(1);
        for (const b of obstacles) {
          if (a !== b) expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeGreaterThan(1);
        }
      }
    }
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
        expect(enemyZones.flat().every(({ x }) => x >= 6)).toBe(true);
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
