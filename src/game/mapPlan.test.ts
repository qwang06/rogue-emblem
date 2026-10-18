import { describe, expect, it } from 'vitest';
import { getCell, type Point } from './grid.ts';
import { checkMap } from './mapCheck.ts';
import { generateTerrain, getReachable, terrainToRows } from './mapGen.ts';
import { MAP_ARCHETYPES } from './mapArchetypes.ts';
import { pickZonedEnemyTiles } from './enemySpawns.ts';
import { carveRoute, generateArchetypeTerrain, generateMap, generatePlannedTerrain, planBattle } from './mapPlan.ts';
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

describe('generateArchetypeTerrain', () => {
  const options = {
    width: 8,
    height: 8,
    generator: 'planned' as const,
    lakes: 1,
    lakeSize: [2, 3] as const,
    mountains: 1,
    mountainSize: [2, 3] as const,
    forests: 2,
    forestSize: [2, 3] as const,
    meadows: 1,
    meadowSize: [2, 3] as const,
    buildings: 1,
  };

  it.each(MAP_ARCHETYPES.filter((a) => a !== 'advance'))(
    'lays out a %s map that keeps every map rule, with enemies where the plan puts them',
    (archetype) => {
      for (const seed of SEEDS.slice(0, 40)) {
        const rng = createSeededRng(seed);
        const map = generateArchetypeTerrain(options, archetype as Exclude<typeof archetype, 'advance'>, rng);
        const enemyTiles = pickZonedEnemyTiles(map.grid, [{ count: 4 }], map.deploymentZone!, map.enemyZones!, rng);
        const problems = checkMap({
          grid: map.grid,
          buildings: map.buildings,
          deploymentZone: map.deploymentZone!,
          enemyTiles: enemyTiles.flat(),
        });
        expect(problems, `${archetype} seed ${seed}`).toEqual([]);
        expect(enemyTiles[0]).toHaveLength(4);
        for (const p of map.deploymentZone!) expect(getCell(map.grid, p.x, p.y)!.unitId).toBeNull();
        if (map.seizeTile)
          expect(Number.isFinite(getMoveCost(getCell(map.grid, map.seizeTile.x, map.seizeTile.y)!.terrain))).toBe(true);
      }
    },
  );

  it('adds no castle or ruins of its own, and turns off patches the plan stands in for', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const gauntlet = generateArchetypeTerrain(
        { ...options, mountains: 4, castle: true, ruins: 2 },
        'gauntlet',
        createSeededRng(seed),
      );
      expect(gauntlet.buildings.some((b) => b.building === 'castle')).toBe(false);
      // Only the ridges' mountains: two rows of them.
      expect(new Set(gauntlet.grid.cells.filter((c) => c.terrain === 'mountain').map((c) => c.y))).toEqual(
        new Set([2, 5]),
      );
      const islands = generateArchetypeTerrain({ ...options, lakes: 4 }, 'islands', createSeededRng(seed));
      const water = islands.grid.cells.filter((c) => c.terrain === 'water');
      expect(water.every((c) => c.y <= 5)).toBe(true);
    }
  });

  it('rejects a map smaller than 6x6', () => {
    expect(() => generateArchetypeTerrain({ width: 5, height: 8 }, 'ambush', createSeededRng(1))).toThrow(/6x6/);
  });
});

describe('generateMap with an archetype', () => {
  it('lays out any archetype but advance from its plan, whatever the generator', () => {
    const map = generateMap({ width: 8, height: 8, archetype: 'fortress' }, createSeededRng(3));
    expect(map.grid.cells.some((c) => c.terrain === 'gate')).toBe(true);
    expect(map.deploymentZone).toHaveLength(3);
  });

  it('builds advance as the generator would', () => {
    const options = { width: 8, height: 8, generator: 'planned' as const };
    expect(generateMap({ ...options, archetype: 'advance' }, createSeededRng(4))).toEqual(
      generateMap(options, createSeededRng(4)),
    );
  });
});
