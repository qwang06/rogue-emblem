import { describe, expect, it } from 'vitest';
import { createGrid, setTerrain, type Point } from './grid.ts';
import { terrainToRows } from './mapGen.ts';
import { findChokepoint, findDetour, openLoops } from './mapLoops.ts';
import { countRoutes } from './mapScore.ts';

const LEGEND: Record<string, string> = { '.': 'grass', '~': 'water', '^': 'mountain', '#': 'wall', _: 'ford' };
const fromRows = (rows: string[]) =>
  rows.reduce(
    (g, row, y) => [...row].reduce((g2, ch, x) => setTerrain(g2, x, y, LEGEND[ch]), g),
    createGrid(rows[0].length, rows.length, 'grass'),
  );

// The player starts on the bottom row, the enemy on the top one.
const ends = (rows: string[]): [Point[], Point[]] => {
  const width = rows[0].length;
  const row = (y: number) => Array.from({ length: width }, (_, x) => ({ x, y })).filter(({ x }) => rows[y][x] === '.');
  return [row(rows.length - 1), row(0)];
};

// One gap in a wall of mountains and water.
const ONE_WAY = ['.....', '.....', '~~.^^', '.....', '.....'];

describe('findChokepoint', () => {
  it('finds the tile every way runs through, the nearest one first', () => {
    // The gap, and the tile south of it, the only way into it.
    expect(findChokepoint(fromRows(ONE_WAY), ...ends(ONE_WAY))).toEqual({ x: 2, y: 3 });
  });

  it('is null with two ways, or none', () => {
    const two = ['.....', '.....', '~.~.^', '.....', '.....'];
    expect(findChokepoint(fromRows(two), ...ends(two))).toBeNull();
    const none = ['.....', '.....', '~~#^^', '.....', '.....'];
    expect(findChokepoint(fromRows(none), ...ends(none))).toBeNull();
  });
});

describe('findDetour', () => {
  it('walks round the tile to avoid, opening the fewest tiles it can', () => {
    const grid = fromRows(ONE_WAY);
    const [from, to] = ends(ONE_WAY);
    const detour = findDetour(grid, from, to, { x: 2, y: 2 })!;
    expect(detour[0].y).toBe(4);
    expect(detour.at(-1)!.y).toBe(0);
    expect(detour.filter((p) => p.y === 2)).toHaveLength(1);
    expect(detour.some((p) => p.x === 2 && p.y === 2)).toBe(false);
  });

  it('never goes through walls', () => {
    const walled = ['.....', '.....', '##.##', '.....', '.....'];
    expect(findDetour(fromRows(walled), ...ends(walled), { x: 2, y: 2 })).toBeNull();
  });
});

describe('openLoops', () => {
  it('opens a ford or a pass beside the chokepoint, so two ways lead through', () => {
    const grid = openLoops(fromRows(ONE_WAY), ...ends(ONE_WAY));
    const [from, to] = ends(ONE_WAY);
    expect(countRoutes(grid, from, to, 2)).toBe(2);
    const row = terrainToRows(grid, { grass: '.', water: '~', mountain: '^', ford: '_' })[2];
    expect([...row].filter((ch, x) => ch !== ONE_WAY[2][x])).toHaveLength(1);
    expect(row).toMatch(/^(_~|~_)\.\^\^$|^~~\.\.\^$|^~~\.\^\.$/);
  });

  it('leaves a map with two ways, or with walls in the way, as it is', () => {
    const two = fromRows(['.....', '.....', '~.~.^', '.....', '.....']);
    expect(openLoops(two, ...ends(['.....', '.....', '~.~.^', '.....', '.....']))).toBe(two);
    const walled = ['.....', '.....', '##.##', '.....', '.....'];
    const grid = fromRows(walled);
    expect(openLoops(grid, ...ends(walled))).toBe(grid);
  });
});
