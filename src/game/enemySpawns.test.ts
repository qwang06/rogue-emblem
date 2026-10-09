import { describe, expect, it } from 'vitest';
import {
  countEnemies,
  getGroupRoom,
  getWalkingDistances,
  isInArea,
  NORTH_THIRD,
  pickEnemyTiles,
  type EnemyGroup,
} from './enemySpawns.ts';
import { createGrid, setTerrain, type Grid, type Point } from './grid.ts';
import { createSeededRng } from './rng.ts';

const key = ({ x, y }: Point) => `${x},${y}`;

// A 10x10 grass field deploying on the middle of the bottom row.
const FIELD = createGrid(10, 10, 'grass');
const ZONE = [
  { x: 4, y: 9 },
  { x: 5, y: 9 },
];

// The field with a wall of water across row 5, open only at x = 0.
const WALLED = Array.from({ length: 9 }, (_, i) => i + 1).reduce(
  (grid: Grid, x) => setTerrain(grid, x, 5, 'water'),
  FIELD,
);

describe('getWalkingDistances', () => {
  it('counts steps from the nearest start', () => {
    const distances = getWalkingDistances(FIELD, ZONE);
    expect(distances.get('4,9')).toBe(0);
    expect(distances.get('5,9')).toBe(0);
    expect(distances.get('5,8')).toBe(1);
    expect(distances.get('0,9')).toBe(4);
    expect(distances.get('9,0')).toBe(13);
    expect(distances.size).toBe(100);
  });

  it('walks around impassable terrain and leaves it out', () => {
    const distances = getWalkingDistances(WALLED, ZONE);
    expect(distances.has('5,5')).toBe(false);
    // 8 steps to the gap at (0, 5), then 5 more back east.
    expect(distances.get('4,4')).toBe(8 + 5);
  });

  it('leaves out tiles nothing can reach', () => {
    const boxed = [
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ].reduce((grid: Grid, p) => setTerrain(grid, p.x, p.y, 'water'), FIELD);
    expect(getWalkingDistances(boxed, ZONE).has('0,0')).toBe(false);
  });

  it('starts nowhere from an impassable start or none', () => {
    expect(getWalkingDistances(setTerrain(FIELD, 0, 0, 'water'), [{ x: 0, y: 0 }]).size).toBe(0);
    expect(getWalkingDistances(FIELD, []).size).toBe(0);
  });
});

describe('isInArea', () => {
  it('covers the whole map when unset', () => {
    expect(FIELD.cells.every((c) => isInArea(c, {}, 10, 10))).toBe(true);
  });

  it('rounds fractions down to whole tiles, the end left out', () => {
    expect(isInArea({ x: 0, y: 3 }, { y: [0, 0.4] }, 10, 10)).toBe(true);
    expect(isInArea({ x: 0, y: 4 }, { y: [0, 0.4] }, 10, 10)).toBe(false);
    expect(isInArea({ x: 0, y: 3 }, NORTH_THIRD, 10, 10)).toBe(false);
    expect(isInArea({ x: 0, y: 2 }, NORTH_THIRD, 10, 10)).toBe(true);
  });

  it('splits an odd map into halves that never overlap', () => {
    const west = { x: [0, 0.5] } as const;
    const east = { x: [0.5, 1] } as const;
    for (let x = 0; x < 11; x++) {
      expect(isInArea({ x, y: 0 }, west, 11, 1) !== isInArea({ x, y: 0 }, east, 11, 1)).toBe(true);
    }
  });

  it('checks both axes', () => {
    const box = { x: [0.5, 1], y: [0, 0.5] } as const;
    expect(isInArea({ x: 7, y: 2 }, box, 10, 10)).toBe(true);
    expect(isInArea({ x: 2, y: 2 }, box, 10, 10)).toBe(false);
    expect(isInArea({ x: 7, y: 7 }, box, 10, 10)).toBe(false);
  });
});

describe('pickEnemyTiles', () => {
  const pick = (groups: EnemyGroup[], grid = FIELD, seed = 1) =>
    pickEnemyTiles(grid, groups, ZONE, createSeededRng(seed));

  it('places each group in its area', () => {
    const [north, east] = pick([
      { count: 3, area: NORTH_THIRD },
      { count: 2, area: { x: [0.8, 1] } },
    ]);
    expect(north).toHaveLength(3);
    expect(east).toHaveLength(2);
    for (const p of north) expect(p.y).toBeLessThan(3);
    for (const p of east) expect(p.x).toBeGreaterThanOrEqual(8);
  });

  it('keeps each group within its walking distances', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const distances = getWalkingDistances(WALLED, ZONE);
      const [far, near] = pick(
        [
          { count: 4, minDistance: 15 },
          { count: 4, minDistance: 2, maxDistance: 3 },
        ],
        WALLED,
        seed,
      );
      for (const p of far) expect(distances.get(key(p))).toBeGreaterThanOrEqual(15);
      for (const p of near) expect(distances.get(key(p))).toBeGreaterThanOrEqual(2);
      for (const p of near) expect(distances.get(key(p))).toBeLessThanOrEqual(3);
    }
  });

  it('measures distance by walking, not as the crow flies', () => {
    // (4, 4) is 5 rows from the zone but 13 steps around the water.
    const [tiles] = pick([{ count: 100, maxDistance: 8 }], WALLED);
    expect(tiles.map(key)).not.toContain('4,4');
    expect(tiles.every((p) => p.y > 5 || p.x <= 2)).toBe(true);
  });

  it('never uses the deployment zone, impassable tiles or a tile twice', () => {
    const tiles = pick([{ count: 50 }, { count: 50 }], WALLED).flat();
    expect(tiles).toHaveLength(100 - ZONE.length - 9);
    expect(new Set(tiles.map(key)).size).toBe(tiles.length);
    for (const p of tiles) expect(ZONE).not.toContainEqual(p);
    for (const p of tiles) expect(p.y === 5 && p.x > 0).toBe(false);
  });

  it('places fewer when too few tiles qualify, and none when no tile does', () => {
    const [few, none, impossible] = pick([
      { count: 5, area: { x: [0, 0.1], y: [0, 0.2] } },
      { count: 3, minDistance: 50 },
      { count: 2, minDistance: 6, maxDistance: 4 },
    ]);
    expect(few).toHaveLength(2);
    expect(none).toEqual([]);
    expect(impossible).toEqual([]);
  });

  it('gives a later group only what earlier groups left', () => {
    const [first, second] = pick([
      { count: 2, area: { x: [0, 0.1], y: [0, 0.2] } },
      { count: 2, area: { x: [0, 0.1], y: [0, 0.2] } },
    ]);
    expect(first).toHaveLength(2);
    expect(second).toEqual([]);
  });

  it('picks the same tiles from the same seed and others from another', () => {
    const groups = [{ count: 4 }];
    expect(pick(groups, FIELD, 7)).toEqual(pick(groups, FIELD, 7));
    const layouts = new Set([1, 2, 3, 4, 5].map((seed) => JSON.stringify(pick(groups, FIELD, seed))));
    expect(layouts.size).toBeGreaterThan(1);
  });

  it('places nothing for no groups', () => {
    expect(pick([])).toEqual([]);
  });
});

describe('getGroupRoom', () => {
  it('measures the reachable tiles in the area and how many fit the distances', () => {
    // Rows 0–1 of the walled field: 20 tiles, all reached through the gap at
    // (0, 5), 8 steps out; the nearest, (0, 1), is 4 more.
    const room = getGroupRoom(WALLED, { count: 1, area: { y: [0, 0.2] }, maxDistance: 14 }, ZONE);
    expect(room.inArea).toBe(20);
    expect(room.nearest).toBe(12);
    expect(room.farthest).toBe(8 + 5 + 9);
    expect(room.fits).toBe(1 + 2 + 2);
  });

  it('counts the whole map, less the deployment zone, with no limits', () => {
    expect(getGroupRoom(FIELD, { count: 1 }, ZONE)).toEqual({ inArea: 98, nearest: 1, farthest: 13, fits: 98 });
  });

  it('finds no room in an area nothing can reach', () => {
    const boxed = [
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ].reduce((grid: Grid, p) => setTerrain(grid, p.x, p.y, 'water'), FIELD);
    const room = getGroupRoom(boxed, { count: 1, area: { x: [0, 0.1], y: [0, 0.1] } }, ZONE);
    expect(room).toEqual({ inArea: 0, nearest: null, farthest: null, fits: 0 });
  });
});

describe('countEnemies', () => {
  it('adds up every group', () => {
    expect(countEnemies([{ count: 2 }, { count: 3, minDistance: 4 }])).toBe(5);
    expect(countEnemies([])).toBe(0);
  });
});
