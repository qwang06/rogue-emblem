import { describe, expect, it } from 'vitest';
import { getCell, type Point } from './grid.ts';
import { checkMap } from './mapCheck.ts';
import { generateTerrain, getReachable, terrainToRows } from './mapGen.ts';
import { carveRoute, generateMap, generatePlannedTerrain, planBattle } from './mapPlan.ts';
import { getMoveCost } from './movement.ts';
import { createSeededRng } from './rng.ts';

const SEEDS = Array.from({ length: 100 }, (_, i) => i * 7919 + 1);
const key = ({ x, y }: Point) => `${x},${y}`;
const isStep = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

describe('planBattle', () => {
  it('deploys on three tiles side by side on the south row', () => {
    for (const seed of SEEDS) {
      const { deploymentZone } = planBattle(8, 8, 3, createSeededRng(seed));
      expect(deploymentZone).toHaveLength(3);
      deploymentZone.forEach((p, i) => {
        expect(p.y).toBe(7);
        expect(p.x).toBe(deploymentZone[0].x + i);
      });
      expect(deploymentZone[0].x).toBeGreaterThanOrEqual(0);
      expect(deploymentZone[2].x).toBeLessThanOrEqual(7);
    }
  });

  it('starts the deployment zone on more than one column', () => {
    const middles = new Set(SEEDS.map((seed) => planBattle(8, 8, 3, createSeededRng(seed)).deploymentZone[1].x));
    expect(middles.size).toBeGreaterThan(2);
  });

  it('puts an anchor per side route in the north third, two columns clear of the start', () => {
    for (const seed of SEEDS) {
      const { deploymentZone, anchors } = planBattle(8, 9, 3, createSeededRng(seed));
      const middle = deploymentZone[1].x;
      expect(anchors.length).toBeGreaterThanOrEqual(1);
      expect(anchors.length).toBeLessThanOrEqual(2);
      for (const { x, y } of anchors) {
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(3);
        expect(Math.abs(x - middle)).toBeGreaterThanOrEqual(2);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(8);
      }
    }
  });

  it('puts two side routes on opposite sides when both have room', () => {
    for (const seed of SEEDS) {
      const { deploymentZone, anchors } = planBattle(8, 8, 3, createSeededRng(seed));
      const middle = deploymentZone[1].x;
      if (middle >= 2 && middle <= 5) {
        expect(anchors).toHaveLength(2);
        expect(Math.sign(anchors[0].x - middle)).toBe(-Math.sign(anchors[1].x - middle));
      }
    }
  });

  it('plans no side routes for a single route', () => {
    expect(planBattle(8, 8, 1, createSeededRng(1)).anchors).toEqual([]);
  });

  it('plans no side routes when the map is too narrow for them', () => {
    expect(planBattle(3, 8, 3, createSeededRng(1)).anchors).toEqual([]);
  });
});

describe('carveRoute', () => {
  it('walks step by step from one end to the other without revisiting a tile', () => {
    for (const seed of SEEDS) {
      const from = { x: 1, y: 7 };
      const to = { x: 6, y: 1 };
      const route = carveRoute(8, 8, from, to, createSeededRng(seed), 0.5);
      expect(route[0]).toEqual(from);
      expect(route[route.length - 1]).toEqual(to);
      for (let i = 1; i < route.length; i++) expect(isStep(route[i - 1], route[i])).toBe(true);
      expect(new Set(route.map(key)).size).toBe(route.length);
      for (const { x, y } of route) {
        expect(x >= 0 && x < 8 && y >= 0 && y < 8).toBe(true);
      }
    }
  });

  it('goes straight there with no wobble', () => {
    const route = carveRoute(8, 8, { x: 2, y: 7 }, { x: 2, y: 2 }, createSeededRng(1), 0);
    expect(route).toEqual([7, 6, 5, 4, 3, 2].map((y) => ({ x: 2, y })));
  });

  it('winds when it wobbles', () => {
    const lengths = SEEDS.map(
      (seed) => carveRoute(8, 8, { x: 2, y: 7 }, { x: 2, y: 0 }, createSeededRng(seed), 0.9).length,
    );
    expect(Math.max(...lengths)).toBeGreaterThan(8);
  });

  it('is a single tile when it starts where it ends', () => {
    expect(carveRoute(8, 8, { x: 3, y: 3 }, { x: 3, y: 3 }, createSeededRng(1))).toEqual([{ x: 3, y: 3 }]);
  });
});

describe('generatePlannedTerrain', () => {
  const OPTIONS = { width: 8, height: 8, lakes: 2, lakeSize: [3, 6], mountains: 2, mountainSize: [3, 5] } as const;
  const walkable = (grid: ReturnType<typeof generateTerrain>['grid'], p: Point) =>
    Number.isFinite(getMoveCost(getCell(grid, p.x, p.y)!.terrain));

  it('rebuilds the same map from the same seed', () => {
    const a = generatePlannedTerrain(OPTIONS, createSeededRng(5));
    const b = generatePlannedTerrain(OPTIONS, createSeededRng(5));
    expect(terrainToRows(a.grid)).toEqual(terrainToRows(b.grid));
    expect(a.routes).toEqual(b.routes);
  });

  it('starts the path in the middle of the deployment zone', () => {
    for (const seed of SEEDS) {
      const { path, plan } = generatePlannedTerrain(OPTIONS, createSeededRng(seed));
      expect(path[0]).toEqual(plan.deploymentZone[1]);
      expect(path[path.length - 1].y).toBe(0);
    }
  });

  it('keeps every route walkable, and every anchor reachable from the start', () => {
    for (const seed of SEEDS) {
      const { grid, path, plan, routes } = generatePlannedTerrain(OPTIONS, createSeededRng(seed));
      for (const p of [...path, ...routes.flat()]) expect(walkable(grid, p)).toBe(true);
      const reachable = getReachable(grid, plan.deploymentZone[1]);
      for (const anchor of plan.anchors) expect(reachable.has(key(anchor))).toBe(true);
      routes.forEach((route, i) => expect(route[route.length - 1]).toEqual(plan.anchors[i]));
    }
  });

  it('keeps the map rules', () => {
    for (const seed of SEEDS) {
      const { grid, buildings, plan } = generatePlannedTerrain(
        { ...OPTIONS, buildings: 2, castle: true },
        createSeededRng(seed),
      );
      expect(checkMap({ grid, buildings, deploymentZone: plan.deploymentZone, enemyTiles: plan.anchors })).toEqual([]);
    }
  });

  it('throws for a map smaller than 3x3', () => {
    expect(() => generatePlannedTerrain({ width: 2, height: 8 }, createSeededRng(1))).toThrow();
  });
});

describe('generateMap', () => {
  it('uses the classic generator unless asked for the planned one', () => {
    const rows = (options: Parameters<typeof generateMap>[0]) =>
      terrainToRows(generateMap(options, createSeededRng(3)).grid);
    expect(rows({ width: 8, height: 8 })).toEqual(
      terrainToRows(generateTerrain({ width: 8, height: 8 }, createSeededRng(3)).grid),
    );
    expect(rows({ width: 8, height: 8, generator: 'classic' })).toEqual(rows({ width: 8, height: 8 }));
    expect(rows({ width: 8, height: 8, generator: 'planned' })).toEqual(
      terrainToRows(generatePlannedTerrain({ width: 8, height: 8 }, createSeededRng(3)).grid),
    );
  });
});
