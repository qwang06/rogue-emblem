import { describe, expect, it } from 'vitest';
import { createGrid, getCell, setTerrain, type Point } from './grid.ts';
import { carvePath, generateTerrain, getReachable, growLake, terrainToRows } from './mapGen.ts';
import { createSeededRng } from './rng.ts';
import { parseTerrainMap } from './terrainMap.ts';

const SEEDS = Array.from({ length: 50 }, (_, i) => i * 7919 + 1);

describe('carvePath', () => {
  it('starts mid-way along the bottom row and ends on the top row', () => {
    const path = carvePath(16, 14, createSeededRng(1));
    expect(path[0]).toEqual({ x: 8, y: 13 });
    expect(path[path.length - 1].y).toBe(0);
  });

  it('runs straight up when it never turns', () => {
    const path = carvePath(5, 4, () => 0.99);
    expect(path).toEqual([
      { x: 2, y: 3 },
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ]);
  });

  it('steps one tile at a time, stays off the side edges, and is never two tiles wide', () => {
    for (const seed of SEEDS) {
      const path = carvePath(16, 14, createSeededRng(seed), 0.9);
      const tiles = new Set(path.map(({ x, y }) => `${x},${y}`));
      path.slice(1).forEach((p, i) => expect(Math.abs(p.x - path[i].x) + Math.abs(p.y - path[i].y)).toBe(1));
      for (const { x, y } of path) {
        expect(x).toBeGreaterThanOrEqual(1);
        expect(x).toBeLessThanOrEqual(14);
        // No 2x2 square of path anywhere.
        expect(tiles.has(`${x + 1},${y}`) && tiles.has(`${x},${y + 1}`) && tiles.has(`${x + 1},${y + 1}`)).toBe(false);
      }
    }
  });
});

describe('growLake', () => {
  const grass = createGrid(5, 5, 'grass');

  it('floods up to `size` connected grass tiles', () => {
    const grid = growLake(grass, { x: 2, y: 2 }, 4, createSeededRng(1), new Set());
    const water = grid.cells.filter((c) => c.terrain === 'water');
    expect(water).toHaveLength(4);
    expect(getReachable(setTerrain(grass, 0, 0, 'grass'), water[0]).size).toBe(25);
  });

  it('stops early when it runs out of room', () => {
    const blocked = new Set(['1,2', '3,2', '2,1', '2,3']);
    const grid = growLake(grass, { x: 2, y: 2 }, 10, createSeededRng(1), blocked);
    expect(grid.cells.filter((c) => c.terrain === 'water')).toHaveLength(1);
  });

  it('leaves the grid alone when the start is blocked or not grass', () => {
    expect(growLake(grass, { x: 2, y: 2 }, 3, createSeededRng(1), new Set(['2,2']))).toBe(grass);
    const dirt = setTerrain(grass, 2, 2, 'dirt');
    expect(growLake(dirt, { x: 2, y: 2 }, 3, createSeededRng(1), new Set())).toBe(dirt);
  });
});

describe('getReachable', () => {
  it('floods walkable tiles and stops at water', () => {
    const grid = parseTerrainMap(['..~.', '..~.', '..~.']);
    const reachable = getReachable(grid, { x: 0, y: 0 });
    expect(reachable.size).toBe(6);
    expect(reachable.has('3,0')).toBe(false);
  });

  it('reaches nothing from an impassable start', () => {
    expect(getReachable(parseTerrainMap(['~.']), { x: 0, y: 0 }).size).toBe(0);
  });
});

describe('generateTerrain', () => {
  it('is the same map for the same seed', () => {
    const a = generateTerrain({ width: 16, height: 14 }, createSeededRng(99));
    const b = generateTerrain({ width: 16, height: 14 }, createSeededRng(99));
    expect(terrainToRows(a.grid)).toEqual(terrainToRows(b.grid));
  });

  it('only uses grass, dirt and water, with dirt exactly on the path', () => {
    for (const seed of SEEDS) {
      const { grid, path } = generateTerrain({ width: 16, height: 14 }, createSeededRng(seed));
      const pathKeys = new Set(path.map(({ x, y }) => `${x},${y}`));
      for (const cell of grid.cells) {
        expect(['grass', 'dirt', 'water']).toContain(cell.terrain);
        expect(cell.terrain === 'dirt').toBe(pathKeys.has(`${cell.x},${cell.y}`));
      }
    }
  });

  it('keeps water a tile clear of the path and out of the top row and bottom two rows', () => {
    for (const seed of SEEDS) {
      const { grid, path } = generateTerrain({ width: 16, height: 14, lakes: 6 }, createSeededRng(seed));
      for (const cell of grid.cells.filter((c) => c.terrain === 'water')) {
        expect(cell.y).toBeGreaterThan(0);
        expect(cell.y).toBeLessThan(12);
        for (const p of path) expect(Math.max(Math.abs(p.x - cell.x), Math.abs(p.y - cell.y))).toBeGreaterThan(1);
      }
    }
  });

  it('can always walk the path from the south edge to the north edge', () => {
    for (const seed of SEEDS) {
      const { grid, path } = generateTerrain({ width: 16, height: 14, lakes: 8 }, createSeededRng(seed));
      const reachable = getReachable(grid, path[0]);
      const end: Point = path[path.length - 1];
      expect(reachable.has(`${end.x},${end.y}`)).toBe(true);
    }
  });

  it('places some water with the default options', () => {
    const lakes = SEEDS.filter((seed) =>
      generateTerrain({ width: 16, height: 14 }, createSeededRng(seed)).grid.cells.some((c) => c.terrain === 'water'),
    );
    expect(lakes.length).toBeGreaterThan(SEEDS.length / 2);
  });

  it('handles the smallest allowed map and rejects smaller ones', () => {
    const { grid } = generateTerrain({ width: 3, height: 3 }, createSeededRng(1));
    expect(terrainToRows(grid)).toEqual(['.,.', '.,.', '.,.']);
    expect(() => generateTerrain({ width: 2, height: 3 }, createSeededRng(1))).toThrow();
  });
});

describe('terrainToRows', () => {
  it('round-trips a parsed terrain map', () => {
    const rows = ['.,~', '~,.'];
    expect(terrainToRows(parseTerrainMap(rows))).toEqual(rows);
  });

  it("uses '?' for terrain it has no character for", () => {
    expect(terrainToRows(createGrid(2, 1))).toEqual(['??']);
    expect(getCell(createGrid(1, 1), 0, 0)!.terrain).toBeNull();
  });
});
