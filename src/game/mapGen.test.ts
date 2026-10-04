import { describe, expect, it } from 'vitest';
import { createGrid, getCell, setTerrain, type Point } from './grid.ts';
import {
  carvePath,
  FIELD_BUILDINGS,
  generateTerrain,
  getReachable,
  getRingCells,
  growPatch,
  placeBuildings,
  placeCastle,
  placeRuin,
  RUIN_BUILDINGS,
  terrainToRows,
  type MapGenOptions,
} from './mapGen.ts';
import { createSeededRng } from './rng.ts';
import { parseTerrainMap } from './terrainMap.ts';

const SEEDS = Array.from({ length: 50 }, (_, i) => i * 7919 + 1);

const key = ({ x, y }: Point) => `${x},${y}`;
// Chebyshev distance: how many king's moves apart two tiles are.
const distance = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const generate = (seed: number, options: Partial<MapGenOptions> = {}) =>
  generateTerrain({ width: 16, height: 14, ...options }, createSeededRng(seed));

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
      const tiles = new Set(path.map(key));
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

describe('growPatch', () => {
  const grass = createGrid(5, 5, 'grass');

  it('turns up to `size` connected grass tiles into the terrain', () => {
    const grid = growPatch(grass, { x: 2, y: 2 }, 4, createSeededRng(1), new Set(), 'water');
    const water = grid.cells.filter((c) => c.terrain === 'water');
    expect(water).toHaveLength(4);
    expect(getReachable(setTerrain(grass, 0, 0, 'grass'), water[0]).size).toBe(25);
  });

  it('grows any terrain it is given', () => {
    const grid = growPatch(grass, { x: 2, y: 2 }, 3, createSeededRng(1), new Set(), 'forest');
    expect(grid.cells.filter((c) => c.terrain === 'forest')).toHaveLength(3);
  });

  it('stops early when it runs out of room', () => {
    const blocked = new Set(['1,2', '3,2', '2,1', '2,3']);
    const grid = growPatch(grass, { x: 2, y: 2 }, 10, createSeededRng(1), blocked, 'water');
    expect(grid.cells.filter((c) => c.terrain === 'water')).toHaveLength(1);
  });

  it('only grows over grass', () => {
    const start = setTerrain(grass, 3, 2, 'dirt');
    const grid = growPatch(start, { x: 2, y: 2 }, 25, createSeededRng(1), new Set(), 'water');
    expect(grid.cells.filter((c) => c.terrain === 'water')).toHaveLength(24);
    expect(getCell(grid, 3, 2)!.terrain).toBe('dirt');
  });

  it('leaves the grid alone when the start is blocked or not grass', () => {
    expect(growPatch(grass, { x: 2, y: 2 }, 3, createSeededRng(1), new Set(['2,2']), 'water')).toBe(grass);
    const dirt = setTerrain(grass, 2, 2, 'dirt');
    expect(growPatch(dirt, { x: 2, y: 2 }, 3, createSeededRng(1), new Set(), 'water')).toBe(dirt);
  });
});

describe('getRingCells', () => {
  it('outlines the rectangle, leaving out the gap', () => {
    const cells = getRingCells(1, 1, 4, 3, { x: 2, y: 3 });
    const grid = cells.reduce((g, { x, y }) => setTerrain(g, x, y, 'wall'), createGrid(6, 5, 'grass'));
    expect(terrainToRows(grid)).toEqual(['......', '.####.', '.#..#.', '.#.##.', '......']);
  });
});

describe('placeCastle', () => {
  // A straight path up column 3 of a 7x6 map.
  const path = carvePath(7, 6, () => 0.99);

  it('stands on grass right beside the path, two or three rows from the north edge', () => {
    const grid = path.reduce((g, p) => setTerrain(g, p.x, p.y, 'dirt'), createGrid(7, 6, 'grass'));
    for (const seed of SEEDS) {
      const castle = placeCastle(grid, path, createSeededRng(seed), new Set())!;
      expect(castle.building).toBe('castle');
      expect([2, 3]).toContain(castle.y);
      expect([2, 4]).toContain(castle.x);
    }
  });

  it('is null when every spot is blocked or not grass', () => {
    expect(placeCastle(createGrid(7, 6, 'dirt'), path, createSeededRng(1), new Set())).toBeNull();
    const blocked = new Set(['2,2', '4,2', '2,3', '4,3']);
    expect(placeCastle(createGrid(7, 6, 'grass'), path, createSeededRng(1), blocked)).toBeNull();
  });
});

describe('placeRuin', () => {
  it('lays a one-tile-wide ring of wall with a south doorway around a ruin building', () => {
    for (const seed of SEEDS) {
      const ruin = placeRuin(createGrid(10, 10, 'grass'), createSeededRng(seed), new Set())!;
      const walls = new Set(ruin.grid.cells.filter((c) => c.terrain === 'wall').map(key));
      const xs = ruin.tiles.map((p) => p.x);
      const ys = ruin.tiles.map((p) => p.y);
      const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      expect(right - left + 1).toBeGreaterThanOrEqual(4);
      expect(bottom - top + 1).toBeGreaterThanOrEqual(4);
      expect(left).toBeGreaterThan(0);
      expect(right).toBeLessThan(9);

      const edge = ruin.tiles.filter((p) => p.x === left || p.x === right || p.y === top || p.y === bottom);
      const gaps = edge.filter((p) => !walls.has(key(p)));
      expect(walls.size).toBe(edge.length - 1);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].y).toBe(bottom);
      expect(gaps[0].x).toBeGreaterThan(left);
      expect(gaps[0].x).toBeLessThan(right);

      const { building } = ruin;
      expect(RUIN_BUILDINGS).toContain(building.building);
      expect(building.x).toBeGreaterThan(left);
      expect(building.x).toBeLessThan(right);
      expect(building.y).toBeGreaterThan(top);
      expect(building.y).toBeLessThan(bottom);
      // The inside can be walked into through the doorway.
      const outside = { x: 0, y: 0 };
      expect(getReachable(ruin.grid, outside).has(key(building))).toBe(true);
    }
  });

  it('only goes where every tile is open grass', () => {
    const water = setTerrain(createGrid(6, 6, 'grass'), 2, 2, 'water');
    expect(placeRuin(water, createSeededRng(1), new Set())).toBeNull();
    expect(placeRuin(createGrid(6, 6, 'grass'), createSeededRng(1), new Set(['2,2']))).toBeNull();
  });

  it('is null on a map too small to hold it', () => {
    expect(placeRuin(createGrid(3, 8, 'grass'), createSeededRng(1), new Set())).toBeNull();
  });
});

describe('placeBuildings', () => {
  it('puts field buildings on open grass, two rows down or more, never side by side', () => {
    const grid = setTerrain(createGrid(8, 8, 'grass'), 4, 4, 'water');
    for (const seed of SEEDS) {
      const buildings = placeBuildings(grid, 5, createSeededRng(seed), new Set(['3,3']));
      expect(buildings.length).toBeGreaterThan(0);
      expect(buildings.length).toBeLessThanOrEqual(5);
      for (const b of buildings) {
        expect(FIELD_BUILDINGS).toContain(b.building);
        expect(getCell(grid, b.x, b.y)!.terrain).toBe('grass');
        expect(b.y).toBeGreaterThanOrEqual(2);
        expect(key(b)).not.toBe('3,3');
        for (const other of buildings) if (other !== b) expect(distance(b, other)).toBeGreaterThan(1);
      }
    }
  });

  it('places none when asked for none or when there is no room', () => {
    expect(placeBuildings(createGrid(5, 5, 'grass'), 0, createSeededRng(1), new Set())).toEqual([]);
    expect(placeBuildings(createGrid(5, 2, 'grass'), 3, createSeededRng(1), new Set())).toEqual([]);
  });
});

describe('getReachable', () => {
  it('floods walkable tiles and stops at water', () => {
    const grid = parseTerrainMap(['..~.', '..~.', '..~.']);
    const reachable = getReachable(grid, { x: 0, y: 0 });
    expect(reachable.size).toBe(6);
    expect(reachable.has('3,0')).toBe(false);
  });

  it('stops at mountains and walls but walks through forests', () => {
    const reachable = getReachable(parseTerrainMap(['.T^.', '..#.']), { x: 0, y: 0 });
    expect([...reachable].sort()).toEqual(['0,0', '0,1', '1,0', '1,1']);
  });

  it('reaches nothing from an impassable start', () => {
    expect(getReachable(parseTerrainMap(['~.']), { x: 0, y: 0 }).size).toBe(0);
  });
});

describe('generateTerrain', () => {
  const IMPASSABLE = ['water', 'mountain', 'wall'];
  const PATCHES = ['water', 'mountain', 'forest', 'meadow'];

  it('is the same map for the same seed', () => {
    const a = generate(99);
    const b = generate(99);
    expect(terrainToRows(a.grid)).toEqual(terrainToRows(b.grid));
    expect(a.buildings).toEqual(b.buildings);
  });

  it('only uses known terrain, with dirt exactly on the path', () => {
    for (const seed of SEEDS) {
      const { grid, path } = generate(seed);
      const pathKeys = new Set(path.map(key));
      for (const cell of grid.cells) {
        expect(['grass', 'dirt', 'water', 'mountain', 'forest', 'meadow', 'wall']).toContain(cell.terrain);
        expect(cell.terrain === 'dirt').toBe(pathKeys.has(key(cell)));
      }
    }
  });

  it('keeps everything but the path out of the top row and the bottom two rows', () => {
    for (const seed of SEEDS) {
      const { grid, buildings } = generate(seed, { lakes: 6, forests: 8, meadows: 8 });
      for (const cell of grid.cells.filter((c) => c.terrain !== 'grass' && c.terrain !== 'dirt')) {
        expect(cell.y).toBeGreaterThan(0);
        expect(cell.y).toBeLessThan(12);
      }
      for (const b of buildings) expect(b.y).toBeLessThan(12);
    }
  });

  it('keeps water, mountains and walls a tile clear of the path', () => {
    for (const seed of SEEDS) {
      const { grid, path } = generate(seed, { lakes: 6, mountains: 6 });
      for (const cell of grid.cells.filter((c) => IMPASSABLE.includes(c.terrain!))) {
        for (const p of path) expect(distance(p, cell)).toBeGreaterThan(1);
      }
    }
  });

  it('can always walk the path from the south edge to the north edge', () => {
    for (const seed of SEEDS) {
      const { grid, path } = generate(seed, { lakes: 8, mountains: 8 });
      const reachable = getReachable(grid, path[0]);
      expect(reachable.has(key(path[path.length - 1]))).toBe(true);
    }
  });

  it('stands every building on grass, two rows down or more, with no patch on or next to it', () => {
    for (const seed of SEEDS) {
      const { grid, buildings } = generate(seed, { lakes: 6, mountains: 6, forests: 8, meadows: 8 });
      for (const b of buildings) {
        expect(getCell(grid, b.x, b.y)!.terrain).toBe('grass');
        expect(b.y).toBeGreaterThanOrEqual(2);
        for (const cell of grid.cells.filter((c) => distance(c, b) <= 1)) {
          expect(PATCHES).not.toContain(cell.terrain);
        }
      }
    }
  });

  it('never builds walls two tiles thick', () => {
    for (const seed of SEEDS) {
      const { grid } = generate(seed);
      const isWall = (x: number, y: number) => getCell(grid, x, y)?.terrain === 'wall';
      for (const { x, y } of grid.cells) {
        expect(isWall(x, y) && isWall(x + 1, y) && isWall(x, y + 1) && isWall(x + 1, y + 1)).toBe(false);
      }
    }
  });

  it('usually has a castle, a ruin, field buildings and every kind of patch', () => {
    const maps = SEEDS.map((seed) => generate(seed));
    const share = (test: (map: (typeof maps)[number]) => boolean) => maps.filter(test).length / maps.length;
    expect(share((m) => m.buildings.some((b) => b.building === 'castle'))).toBeGreaterThan(0.9);
    expect(share((m) => m.grid.cells.some((c) => c.terrain === 'wall'))).toBeGreaterThan(0.5);
    expect(share((m) => m.buildings.some((b) => FIELD_BUILDINGS.includes(b.building)))).toBeGreaterThan(0.9);
    for (const terrain of PATCHES) {
      expect(share((m) => m.grid.cells.some((c) => c.terrain === terrain))).toBeGreaterThan(0.5);
    }
  });

  it('grows every kind of patch it is asked for while there is room', () => {
    for (const seed of SEEDS) {
      const { grid } = generate(seed);
      for (const terrain of PATCHES) expect(grid.cells.some((c) => c.terrain === terrain)).toBe(true);
    }
  });

  it('lays only the path when every other layer is turned off', () => {
    const { grid, buildings } = generate(5, {
      lakes: 0,
      mountains: 0,
      forests: 0,
      meadows: 0,
      castle: false,
      ruins: 0,
      buildings: 0,
    });
    expect(buildings).toEqual([]);
    expect(grid.cells.every((c) => c.terrain === 'grass' || c.terrain === 'dirt')).toBe(true);
  });

  it('handles the smallest allowed map and rejects smaller ones', () => {
    const { grid, buildings } = generateTerrain({ width: 3, height: 3 }, createSeededRng(1));
    expect(terrainToRows(grid)).toEqual(['.,.', '.,.', '.,.']);
    expect(buildings).toEqual([]);
    expect(() => generateTerrain({ width: 2, height: 3 }, createSeededRng(1))).toThrow();
  });
});

describe('terrainToRows', () => {
  it('round-trips a parsed terrain map', () => {
    const rows = ['.,~#', '~,T^', '"...'];
    expect(terrainToRows(parseTerrainMap(rows))).toEqual(rows);
  });

  it("uses '?' for terrain it has no character for", () => {
    expect(terrainToRows(createGrid(2, 1))).toEqual(['??']);
    expect(getCell(createGrid(1, 1), 0, 0)!.terrain).toBeNull();
  });
});
