import { describe, expect, it } from 'vitest';
import type { Point } from './grid.ts';
import {
  carveRoad,
  hasBlock,
  MAP_ARCHETYPES,
  planAmbush,
  planArchetype,
  planCrossroads,
  planFortress,
  planGauntlet,
  planIslands,
  rect,
  type ArchetypePlan,
  type MapArchetype,
} from './mapArchetypes.ts';
import { createSeededRng } from './rng.ts';

const key = ({ x, y }: Point) => `${x},${y}`;
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const SIZES: [number, number][] = [
  [8, 8],
  [6, 6],
  [12, 10],
];
const PLANNED = MAP_ARCHETYPES.filter((a): a is Exclude<MapArchetype, 'advance'> => a !== 'advance');

const terrainAt = (plan: ArchetypePlan, p: Point) => plan.terrain.find((t) => t.x === p.x && t.y === p.y)?.terrain;

// An islands plan's river in column `x` (two deep, so a channel above it
// isn't counted) and the river's top row there.
const riverAt = (plan: ArchetypePlan, x: number) => {
  const bottom = Math.max(...plan.terrain.filter((t) => t.x === x).map((t) => t.y));
  return plan.terrain.filter((t) => t.x === x && t.y >= bottom - 1);
};
const riverTop = (plan: ArchetypePlan, x: number) => Math.min(...riverAt(plan, x).map((t) => t.y));

describe('carveRoad', () => {
  it('runs from one end to the other, a step at a time, only ever closer', () => {
    for (const seed of SEEDS) {
      const road = carveRoad({ x: 1, y: 7 }, { x: 6, y: 0 }, createSeededRng(seed));
      expect(road[0]).toEqual({ x: 1, y: 7 });
      expect(road[road.length - 1]).toEqual({ x: 6, y: 0 });
      expect(road).toHaveLength(13);
      for (let i = 1; i < road.length; i++) {
        expect(road[i].x - road[i - 1].x).toBeGreaterThanOrEqual(0);
        expect(road[i].y - road[i - 1].y).toBeLessThanOrEqual(0);
      }
      expect(hasBlock(road)).toBe(false);
    }
  });

  it('is straight between tiles on one row, and a single tile when they match', () => {
    expect(carveRoad({ x: 4, y: 2 }, { x: 0, y: 2 }, createSeededRng(1))).toEqual(rect(0, 2, 4, 2).reverse());
    expect(carveRoad({ x: 3, y: 3 }, { x: 3, y: 3 }, createSeededRng(1))).toEqual([{ x: 3, y: 3 }]);
  });
});

describe('hasBlock', () => {
  it('finds four tiles in a 2x2 square, and only then', () => {
    expect(hasBlock(rect(2, 2, 3, 3))).toBe(true);
    expect(hasBlock([...rect(0, 0, 3, 0), ...rect(0, 1, 0, 3)])).toBe(false);
    expect(hasBlock([])).toBe(false);
  });
});

describe('every archetype plan', () => {
  it.each(PLANNED)('%s keeps to the map and gives each side somewhere to stand', (archetype) => {
    for (const [width, height] of SIZES) {
      for (const seed of SEEDS) {
        const plan = planArchetype(archetype, width, height, createSeededRng(seed));
        const inside = ({ x, y }: Point) => x >= 0 && y >= 0 && x < width && y < height;
        const all = [
          ...plan.deploymentZone,
          ...plan.enemyZones.flat(),
          ...plan.path,
          ...plan.routes.flat(),
          ...plan.terrain,
          ...plan.reserved,
        ];
        expect(all.every(inside), `${archetype} ${width}x${height} seed ${seed}`).toBe(true);
        expect(plan.deploymentZone).toHaveLength(3);
        expect(plan.enemyZones.length).toBeGreaterThan(0);
        for (const zone of plan.enemyZones) expect(zone.length).toBeGreaterThan(0);
        // The road is dirt: never a 2x2 block, and never over the plan's own terrain.
        expect(hasBlock(plan.path)).toBe(false);
        expect(plan.path.some((p) => terrainAt(plan, p) !== undefined)).toBe(false);
        // Nobody deploys on planned terrain or in the enemy's zones.
        const enemy = new Set(plan.enemyZones.flat().map(key));
        for (const p of plan.deploymentZone) {
          expect(terrainAt(plan, p)).toBeUndefined();
          expect(enemy.has(key(p))).toBe(false);
        }
      }
    }
  });

  it('gives the same plan for the same seed', () => {
    for (const archetype of PLANNED) {
      expect(planArchetype(archetype, 8, 8, createSeededRng(5))).toEqual(
        planArchetype(archetype, 8, 8, createSeededRng(5)),
      );
    }
  });
});

describe('planCrossroads', () => {
  it('crosses roads in the middle columns of the north half, with the enemy on both flanks', () => {
    for (const seed of SEEDS) {
      const plan = planCrossroads(8, 8, createSeededRng(seed));
      const center = plan.seizeTile!;
      expect(center.x).toBeGreaterThanOrEqual(3);
      expect(center.x).toBeLessThanOrEqual(4);
      expect(center.y).toBeLessThanOrEqual(4);
      const path = new Set(plan.path.map(key));
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        expect(path.has(key({ x: center.x + dx, y: center.y + dy }))).toBe(true);
      }
      // Roads reach the west, east and south edges.
      expect(plan.path.some((p) => p.x === 0)).toBe(true);
      expect(plan.path.some((p) => p.x === 7)).toBe(true);
      expect(plan.path.some((p) => p.y === 7)).toBe(true);
      const [west, east] = plan.enemyZones;
      expect(west.every((p) => p.x <= 1)).toBe(true);
      expect(east.every((p) => p.x >= 6)).toBe(true);
      expect(plan.deploymentZone.every((p) => p.y === 7)).toBe(true);
    }
  });
});

describe('planAmbush', () => {
  it('deploys in the middle with the enemy on two or three edges', () => {
    for (const seed of SEEDS) {
      const plan = planAmbush(8, 8, createSeededRng(seed));
      for (const p of plan.deploymentZone) {
        expect(p.y).toBeGreaterThanOrEqual(3);
        expect(p.y).toBeLessThanOrEqual(4);
        expect(p.x).toBeGreaterThanOrEqual(2);
        expect(p.x).toBeLessThanOrEqual(5);
      }
      expect(plan.enemyZones.length).toBeGreaterThanOrEqual(2);
      expect(plan.enemyZones.length).toBeLessThanOrEqual(3);
      for (const zone of plan.enemyZones) {
        const onEdge = (p: Point) => p.x === 0 || p.y === 0 || p.x === 7 || p.y === 7;
        expect(zone.every(onEdge)).toBe(true);
      }
      // A road (or route) heads out to each edge.
      expect(1 + plan.routes.length).toBe(plan.enemyZones.length);
    }
  });
});

describe('planGauntlet', () => {
  it('starts in a south corner and folds the road between two ridges with one forest gap', () => {
    for (const seed of SEEDS) {
      const plan = planGauntlet(8, 8, createSeededRng(seed));
      const xs = plan.deploymentZone.map((p) => p.x);
      expect(plan.deploymentZone.every((p) => p.y === 7)).toBe(true);
      expect(xs.includes(0) || xs.includes(7)).toBe(true);
      const kinds = plan.terrain.map((t) => t.terrain);
      expect(kinds.filter((k) => k === 'forest')).toHaveLength(1);
      expect(kinds.filter((k) => k === 'mountain').length).toBeGreaterThanOrEqual(8);
      expect(new Set(plan.terrain.map((t) => t.y))).toEqual(new Set([2, 5]));
      // The road reaches the north edge, where the enemy waits.
      expect(plan.seizeTile!.y).toBe(0);
      expect(plan.enemyZones[0].every((p) => p.y < 2)).toBe(true);
      expect(plan.fill).toEqual({ mountains: 0 });
    }
  });

  it('has a single ridge on a map too short for two', () => {
    const plan = planGauntlet(6, 6, createSeededRng(3));
    expect(new Set(plan.terrain.map((t) => t.y))).toEqual(new Set([3]));
  });
});

describe('planIslands', () => {
  it('runs a river across every column, crossed by two or three level bridges and fords', () => {
    for (const seed of SEEDS) {
      const plan = planIslands(8, 8, createSeededRng(seed));
      const river = (x: number) => riverAt(plan, x);
      const top = (x: number) => riverTop(plan, x);
      const crossings = rect(0, 0, 7, 0)
        .map((p) => p.x)
        .filter((x) => river(x).every((t) => t.terrain === 'bridge' || t.terrain === 'ford') && river(x).length > 0);
      expect(crossings.length).toBeGreaterThanOrEqual(2);
      expect(crossings.length).toBeLessThanOrEqual(3);
      for (const x of crossings) {
        expect(top(x - 1)).toBe(top(x));
        expect(top(x + 1)).toBe(top(x));
      }
      for (let x = 0; x < 8; x++) expect(river(x).length, `column ${x}`).toBeGreaterThanOrEqual(2);
      expect(plan.terrain.some((t) => t.terrain === 'bridge')).toBe(true);
      // The enemy holds the far bank (one island each side of a channel).
      for (const zone of plan.enemyZones) expect(zone.every((p) => p.y < top(p.x))).toBe(true);
      expect(plan.fill).toEqual({ lakes: 0 });
    }
  });

  it('holds each river row for at least two columns', () => {
    for (const seed of SEEDS) {
      const plan = planIslands(10, 8, createSeededRng(seed));
      const tops = rect(0, 0, 9, 0).map(({ x }) => riverTop(plan, x));
      const runs: number[] = [];
      tops.forEach((top, x) => (x > 0 && top === tops[x - 1] ? runs[runs.length - 1]++ : runs.push(1)));
      expect(Math.min(...runs), `seed ${seed}: ${tops}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('splits the far bank into two islands with a two-wide channel and one bridge, some of the time', () => {
    const split = SEEDS.map((seed) => planIslands(8, 8, createSeededRng(seed))).filter(
      (p) => p.enemyZones.length === 2,
    );
    expect(split.length).toBeGreaterThan(0);
    for (const plan of split) {
      const [west, east] = plan.enemyZones;
      const gap = Math.min(...east.map((p) => p.x)) - Math.max(...west.map((p) => p.x));
      expect(gap).toBe(3);
    }
  });
});

describe('planFortress', () => {
  it('walls the enemy in a fort off the sides and top, with gates in its south wall', () => {
    for (const seed of SEEDS) {
      const plan = planFortress(8, 8, createSeededRng(seed));
      const walls = plan.terrain.filter((t) => t.terrain === 'wall');
      const gates = plan.terrain.filter((t) => t.terrain === 'gate');
      expect(walls.every((t) => t.x > 0 && t.x < 7 && t.y > 0)).toBe(true);
      expect(gates.length).toBeGreaterThanOrEqual(1);
      expect(gates.length).toBeLessThanOrEqual(2);
      const gateRow = Math.max(...plan.terrain.map((t) => t.y));
      expect(gates.every((g) => g.y === gateRow)).toBe(true);
      if (gates.length === 2) expect(Math.abs(gates[0].x - gates[1].x)).toBeGreaterThanOrEqual(3);
      const [fort] = plan.buildings;
      expect(fort.building).toBe('fort');
      expect(plan.seizeTile).toEqual({ x: fort.x, y: fort.y });
      expect(plan.enemyZones[0].some((p) => p.x === fort.x && p.y === fort.y)).toBe(true);
      // The road runs up to each gate and on inside.
      const path = new Set(plan.path.map(key));
      for (const g of gates) {
        expect(path.has(key({ x: g.x, y: g.y + 1 }))).toBe(true);
        expect(path.has(key({ x: g.x, y: g.y - 1 }))).toBe(true);
      }
      expect(path.has(key(fort))).toBe(false);
    }
  });
});
