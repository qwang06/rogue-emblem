import { describe, expect, it } from 'vitest';
import { createGrid, getCell, setTerrain, type Grid } from './grid.ts';
import { getReachable, terrainToRows } from './mapGen.ts';
import { createSeededRng } from './rng.ts';
import { fillPockets, growCaveWalls, growShapedPatch, smoothPatches } from './terrainShapes.ts';

const count = (grid: Grid, terrain: string) => grid.cells.filter((c) => c.terrain === terrain).length;
const fromRows = (rows: string[]) =>
  rows.reduce(
    (g, row, y) =>
      [...row].reduce(
        (g2, ch, x) =>
          setTerrain(g2, x, y, { '.': 'grass', '~': 'water', '^': 'mountain', T: 'forest', ',': 'dirt' }[ch]!),
        g,
      ),
    createGrid(rows[0].length, rows.length, 'grass'),
  );

describe('growShapedPatch', () => {
  const grass = createGrid(7, 7, 'grass');

  it('turns up to `size` connected grass tiles into the terrain', () => {
    const grid = growShapedPatch(grass, { x: 3, y: 3 }, 5, createSeededRng(1), new Set(), 'water');
    expect(count(grid, 'water')).toBe(5);
    const water = grid.cells.filter((c) => c.terrain === 'water');
    const walkWater = water.reduce((g, c) => setTerrain(g, c.x, c.y, 'grass'), createGrid(7, 7, 'wall'));
    expect(getReachable(walkWater, water[0]).size).toBe(5);
  });

  it('stops early when it runs out of room, and only grows over grass', () => {
    const blocked = new Set(['2,3', '4,3', '3,2', '3,4']);
    expect(count(growShapedPatch(grass, { x: 3, y: 3 }, 10, createSeededRng(1), blocked, 'water'), 'water')).toBe(1);
    const road = setTerrain(grass, 4, 3, 'dirt');
    const grid = growShapedPatch(road, { x: 3, y: 3 }, 49, createSeededRng(1), new Set(), 'forest');
    expect(count(grid, 'forest')).toBe(48);
    expect(getCell(grid, 4, 3)!.terrain).toBe('dirt');
  });

  it('leaves the grid alone when the start is blocked or not grass', () => {
    expect(growShapedPatch(grass, { x: 3, y: 3 }, 3, createSeededRng(1), new Set(['3,3']), 'water')).toBe(grass);
    const dirt = setTerrain(grass, 3, 3, 'dirt');
    expect(growShapedPatch(dirt, { x: 3, y: 3 }, 3, createSeededRng(1), new Set(), 'water')).toBe(dirt);
  });

  // Tiles of the patch with at most one of its own beside them.
  const spurs = (grid: Grid, terrain: string) =>
    grid.cells.filter(
      (c) =>
        c.terrain === terrain &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].filter(([dx, dy]) => getCell(grid, c.x + dx, c.y + dy)?.terrain === terrain).length <= 1,
    ).length;

  it('grows blobs into clumps with few spurs', () => {
    let total = 0;
    for (let seed = 0; seed < 20; seed++) {
      total += spurs(growShapedPatch(grass, { x: 3, y: 3 }, 8, createSeededRng(seed), new Set(), 'water'), 'water');
    }
    expect(total / 20).toBeLessThan(2.5);
  });

  it('grows ridges long and thin, along a row or a column', () => {
    for (let seed = 0; seed < 10; seed++) {
      const grid = growShapedPatch(grass, { x: 3, y: 3 }, 6, createSeededRng(seed), new Set(), 'mountain', 'ridge');
      const tiles = grid.cells.filter((c) => c.terrain === 'mountain');
      const xs = new Set(tiles.map((c) => c.x)).size;
      const ys = new Set(tiles.map((c) => c.y)).size;
      expect(Math.max(xs, ys)).toBeGreaterThanOrEqual(4);
      expect(Math.min(xs, ys)).toBeLessThanOrEqual(3);
      expect(Math.max(xs, ys)).toBeGreaterThan(Math.min(xs, ys));
    }
  });
});

describe('smoothPatches', () => {
  it('fills grass mostly wrapped by one terrain, judging each tile on the grid as it was', () => {
    const grid = fromRows(['~~~..', '~.~..', '~~...', '.....']);
    expect(terrainToRows(smoothPatches(grid, ['water'], () => true))).toEqual(['~~~..', '~~~..', '~~...', '.....']);
  });

  it('leaves out what canFill turns down, and non-grass tiles', () => {
    const grid = fromRows(['TTT', 'T.T', 'TTT']);
    expect(smoothPatches(grid, ['forest'], () => false)).toBe(grid);
    const road = fromRows(['TTT', 'T,T', 'TTT']);
    expect(smoothPatches(road, ['forest'], () => true)).toBe(road);
  });
});

describe('growCaveWalls', () => {
  it('grows rock hugging the sides, never on blocked or non-grass tiles', () => {
    const base = setTerrain(createGrid(12, 10, 'grass'), 6, 5, 'dirt');
    const blocked = new Set(['5,5', '7,5']);
    const grid = growCaveWalls(base, createSeededRng(3), blocked);
    expect(getCell(grid, 6, 5)!.terrain).toBe('dirt');
    expect(getCell(grid, 5, 5)!.terrain).toBe('grass');
    expect(getCell(grid, 7, 5)!.terrain).toBe('grass');
    const rock = count(grid, 'mountain');
    expect(rock).toBeGreaterThan(10);
    expect(rock).toBeLessThan(110);
    const edge = grid.cells.filter((c) => c.x === 0 || c.y === 0 || c.x === 11 || c.y === 9);
    const inner = grid.cells.filter((c) => !edge.includes(c));
    const share = (cells: typeof edge) => cells.filter((c) => c.terrain === 'mountain').length / cells.length;
    expect(share(edge)).toBeGreaterThan(share(inner));
  });

  it('is the same for the same seed', () => {
    const base = createGrid(10, 8, 'grass');
    expect(growCaveWalls(base, createSeededRng(9), new Set())).toEqual(
      growCaveWalls(base, createSeededRng(9), new Set()),
    );
  });
});

describe('fillPockets', () => {
  it('fills open ground walled off from the start, unless it holds a kept tile', () => {
    const grid = fromRows(['..^.', '^^^.', '.^..', '^^^.', '.^T^']);
    expect(terrainToRows(fillPockets(grid, { x: 3, y: 0 }, new Set(['0,4'])))).toEqual([
      '^^^.',
      '^^^.',
      '^^..',
      '^^^.',
      '.^^^',
    ]);
  });

  it('leaves a pocket with a road or water crossing in it', () => {
    const grid = fromRows(['.^,', '^^^', '..^']);
    expect(terrainToRows(fillPockets(grid, { x: 0, y: 2 }, new Set()))).toEqual(['^^,', '^^^', '..^']);
  });
});
