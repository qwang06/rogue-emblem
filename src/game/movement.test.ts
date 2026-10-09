import { describe, expect, it } from 'vitest';
import { createGrid, setTerrain, setUnit, type Point } from './grid.ts';
import {
  canMoveAlongPath,
  extendMovePath,
  getMoveCost,
  getMovePath,
  getMovementRange,
  getPathCost,
} from './movement.ts';

// Sorted "x,y" strings so assertions don't depend on traversal order.
function tiles(range: readonly Point[]) {
  return range.map(({ x, y }) => `${x},${y}`).sort();
}

function find<T extends Point>(range: readonly T[], x: number, y: number) {
  return range.find((t) => t.x === x && t.y === y);
}

describe('getMoveCost', () => {
  it('uses the terrain cost table', () => {
    expect(getMoveCost('grass')).toBe(1);
    expect(getMoveCost('water')).toBe(Infinity);
    expect(getMoveCost('dirt')).toBe(1);
    expect(getMoveCost('wall')).toBe(Infinity);
    expect(getMoveCost('forest')).toBe(2);
    expect(getMoveCost('mountain')).toBe(Infinity);
    expect(getMoveCost('meadow')).toBe(1);
  });

  it('defaults unknown and null terrain to 1', () => {
    expect(getMoveCost('lava')).toBe(1);
    expect(getMoveCost(null)).toBe(1);
  });

  it('accepts a custom table', () => {
    expect(getMoveCost('forest', { forest: 2 })).toBe(2);
  });
});

describe('getMovementRange', () => {
  it('returns only the origin with zero movement', () => {
    const grid = createGrid(5, 5, 'grass');
    expect(getMovementRange(grid, { x: 2, y: 2 }, 0)).toEqual([{ x: 2, y: 2, cost: 0 }]);
  });

  it('reaches a diamond of orthogonal steps on open ground', () => {
    const grid = createGrid(5, 5, 'grass');
    const range = getMovementRange(grid, { x: 2, y: 2 }, 1);
    expect(tiles(range)).toEqual(['1,2', '2,1', '2,2', '2,3', '3,2']);
  });

  it('covers 2n(n+1)+1 tiles for movement n with room to spare', () => {
    const grid = createGrid(11, 11, 'grass');
    expect(getMovementRange(grid, { x: 5, y: 5 }, 3)).toHaveLength(25);
  });

  it('records the cheapest cost to each tile', () => {
    const grid = createGrid(5, 5, 'grass');
    const range = getMovementRange(grid, { x: 0, y: 0 }, 4);
    expect(find(range, 0, 0)!.cost).toBe(0);
    expect(find(range, 2, 2)!.cost).toBe(4);
  });

  it('is clipped at the map boundary', () => {
    const grid = createGrid(3, 3, 'grass');
    const range = getMovementRange(grid, { x: 0, y: 0 }, 1);
    expect(tiles(range)).toEqual(['0,0', '0,1', '1,0']);
  });

  it('never enters impassable terrain', () => {
    let grid = createGrid(5, 1, 'grass');
    grid = setTerrain(grid, 2, 0, 'water');
    const range = getMovementRange(grid, { x: 0, y: 0 }, 10);
    expect(tiles(range)).toEqual(['0,0', '1,0']);
  });

  it('routes around obstacles, spending the extra steps', () => {
    let grid = createGrid(3, 3, 'grass');
    grid = setTerrain(grid, 1, 0, 'water');
    grid = setTerrain(grid, 1, 1, 'water');
    // From (0,0) to (2,0) must go down around the water: 6 steps.
    expect(find(getMovementRange(grid, { x: 0, y: 0 }, 5), 2, 0)).toBeUndefined();
    expect(find(getMovementRange(grid, { x: 0, y: 0 }, 6), 2, 0)!.cost).toBe(6);
  });

  it('charges higher terrain costs', () => {
    let grid = createGrid(3, 1, 'grass');
    grid = setTerrain(grid, 1, 0, 'forest');
    const terrainCosts = { grass: 1, forest: 2 };
    expect(tiles(getMovementRange(grid, { x: 0, y: 0 }, 2, { terrainCosts }))).toEqual(['0,0', '1,0']);
    expect(find(getMovementRange(grid, { x: 0, y: 0 }, 3, { terrainCosts }), 2, 0)!.cost).toBe(3);
  });

  it('is blocked by other units by default', () => {
    let grid = createGrid(4, 1, 'grass');
    grid = setUnit(grid, 0, 0, 'mover');
    grid = setUnit(grid, 1, 0, 'enemy');
    expect(tiles(getMovementRange(grid, { x: 0, y: 0 }, 3))).toEqual(['0,0']);
  });

  it('passes through units canPassThrough allows, but never ends on them', () => {
    let grid = createGrid(4, 1, 'grass');
    grid = setUnit(grid, 0, 0, 'mover');
    grid = setUnit(grid, 1, 0, 'ally');
    const range = getMovementRange(grid, { x: 0, y: 0 }, 3, {
      canPassThrough: (id) => id === 'ally',
    });
    expect(tiles(range)).toEqual(['0,0', '2,0', '3,0']);
  });

  it('includes the origin even though the mover occupies it', () => {
    let grid = createGrid(3, 3, 'grass');
    grid = setUnit(grid, 1, 1, 'mover');
    expect(find(getMovementRange(grid, { x: 1, y: 1 }, 1), 1, 1)).toEqual({ x: 1, y: 1, cost: 0 });
  });

  it('returns nothing for an out-of-bounds origin', () => {
    const grid = createGrid(3, 3, 'grass');
    expect(getMovementRange(grid, { x: 5, y: 5 }, 3)).toEqual([]);
  });
});

// True if every consecutive pair of tiles is one orthogonal step apart.
function isStepByStep(path: readonly Point[]) {
  return path.every((tile, i) => {
    if (i === 0) return true;
    const prev = path[i - 1];
    return Math.abs(tile.x - prev.x) + Math.abs(tile.y - prev.y) === 1;
  });
}

describe('getMovePath', () => {
  it('returns just the origin when the destination is the origin', () => {
    const grid = createGrid(3, 3, 'grass');
    expect(getMovePath(grid, { x: 1, y: 1 }, { x: 1, y: 1 }, 3)).toEqual([{ x: 1, y: 1 }]);
  });

  it('walks a straight line one tile at a time', () => {
    const grid = createGrid(5, 1, 'grass');
    expect(getMovePath(grid, { x: 0, y: 0 }, { x: 3, y: 0 }, 5)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it('takes a shortest step-by-step route to diagonal targets', () => {
    const grid = createGrid(5, 5, 'grass');
    const path = getMovePath(grid, { x: 0, y: 0 }, { x: 2, y: 3 }, 5);
    expect(path).toHaveLength(6);
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path!.at(-1)).toEqual({ x: 2, y: 3 });
    expect(isStepByStep(path!)).toBe(true);
  });

  it('routes around impassable terrain', () => {
    let grid = createGrid(3, 3, 'grass');
    grid = setTerrain(grid, 1, 0, 'water');
    grid = setTerrain(grid, 1, 1, 'water');
    const path = getMovePath(grid, { x: 0, y: 0 }, { x: 2, y: 0 }, 6);
    expect(path).toHaveLength(7);
    expect(isStepByStep(path!)).toBe(true);
    expect(path!.some(({ x, y }) => grid.cells[y * 3 + x].terrain === 'water')).toBe(false);
  });

  it('prefers cheaper terrain over fewer steps', () => {
    let grid = createGrid(3, 2, 'grass');
    grid = setTerrain(grid, 1, 0, 'forest');
    const terrainCosts = { grass: 1, forest: 5 };
    const path = getMovePath(grid, { x: 0, y: 0 }, { x: 2, y: 0 }, 5, { terrainCosts });
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ]);
  });

  it('walks through units canPassThrough allows', () => {
    let grid = createGrid(3, 1, 'grass');
    grid = setUnit(grid, 0, 0, 'mover');
    grid = setUnit(grid, 1, 0, 'ally');
    const path = getMovePath(grid, { x: 0, y: 0 }, { x: 2, y: 0 }, 2, {
      canPassThrough: (id) => id === 'ally',
    });
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  it('returns null for a tile beyond the movement range', () => {
    const grid = createGrid(5, 1, 'grass');
    expect(getMovePath(grid, { x: 0, y: 0 }, { x: 4, y: 0 }, 3)).toBeNull();
  });

  it('returns null for impassable or unreachable tiles', () => {
    let grid = createGrid(3, 1, 'grass');
    grid = setTerrain(grid, 1, 0, 'water');
    expect(getMovePath(grid, { x: 0, y: 0 }, { x: 1, y: 0 }, 5)).toBeNull();
    expect(getMovePath(grid, { x: 0, y: 0 }, { x: 2, y: 0 }, 5)).toBeNull();
  });

  it('returns null for a tile occupied by another unit', () => {
    let grid = createGrid(3, 1, 'grass');
    grid = setUnit(grid, 0, 0, 'mover');
    grid = setUnit(grid, 1, 0, 'ally');
    const options = { canPassThrough: () => true };
    expect(getMovePath(grid, { x: 0, y: 0 }, { x: 1, y: 0 }, 3, options)).toBeNull();
  });

  it('returns null for out-of-bounds origin or destination', () => {
    const grid = createGrid(3, 3, 'grass');
    expect(getMovePath(grid, { x: 9, y: 9 }, { x: 0, y: 0 }, 3)).toBeNull();
    expect(getMovePath(grid, { x: 0, y: 0 }, { x: -1, y: 0 }, 3)).toBeNull();
  });

  it('agrees with getMovementRange on which tiles are reachable', () => {
    let grid = createGrid(6, 6, 'grass');
    grid = setTerrain(grid, 2, 2, 'water');
    grid = setTerrain(grid, 3, 2, 'water');
    grid = setUnit(grid, 1, 3, 'enemy');
    const origin = { x: 1, y: 1 };
    const range = getMovementRange(grid, origin, 4);
    for (const cell of grid.cells) {
      const inRange = range.some((t) => t.x === cell.x && t.y === cell.y);
      const path = getMovePath(grid, origin, cell, 4);
      expect(path !== null).toBe(inRange);
      if (path) expect(isStepByStep(path!)).toBe(true);
    }
  });
});

describe('getPathCost', () => {
  it('is zero for a path that stays put', () => {
    const grid = createGrid(3, 3, 'grass');
    expect(getPathCost(grid, [{ x: 1, y: 1 }])).toBe(0);
  });

  it('sums the cost of each tile entered, not the origin', () => {
    let grid = createGrid(3, 1, 'grass');
    grid = setTerrain(grid, 0, 0, 'forest');
    grid = setTerrain(grid, 2, 0, 'forest');
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    expect(getPathCost(grid, path, { forest: 3 })).toBe(4);
  });
});

describe('extendMovePath', () => {
  const origin = { x: 2, y: 2 };

  it('appends a step next to the end of the path', () => {
    const grid = createGrid(5, 5, 'grass');
    const path = extendMovePath(grid, [origin], { x: 3, y: 2 }, 3);
    expect(path).toEqual([origin, { x: 3, y: 2 }]);
  });

  it('follows the traced route instead of the cheapest one', () => {
    const grid = createGrid(5, 5, 'grass');
    let path: readonly Point[] = [origin];
    for (const step of [
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]) {
      path = extendMovePath(grid, path, step, 3);
    }
    expect(path).toEqual([origin, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }]);
  });

  it('cuts back to a tile already on the path', () => {
    const grid = createGrid(5, 5, 'grass');
    const path = [origin, { x: 3, y: 2 }, { x: 4, y: 2 }];
    expect(extendMovePath(grid, path, { x: 3, y: 2 }, 3)).toEqual([origin, { x: 3, y: 2 }]);
    expect(extendMovePath(grid, path, origin, 3)).toEqual([origin]);
  });

  it('returns the same path when the target is already its end', () => {
    const grid = createGrid(5, 5, 'grass');
    const path = [origin, { x: 3, y: 2 }];
    expect(extendMovePath(grid, path, { x: 3, y: 2 }, 3)).toBe(path);
  });

  it('falls back to the cheapest route once the trace runs out of movement', () => {
    const grid = createGrid(5, 5, 'grass');
    // Wandered up and over; stepping down again would cost 3 > 2.
    const path = [origin, { x: 2, y: 1 }, { x: 3, y: 1 }];
    const next = extendMovePath(grid, path, { x: 3, y: 2 }, 2);
    expect(next).toEqual([origin, { x: 3, y: 2 }]);
  });

  it('falls back to the cheapest route when the target is not adjacent', () => {
    const grid = createGrid(5, 5, 'grass');
    const next = extendMovePath(grid, [origin], { x: 4, y: 2 }, 3);
    expect(next).toEqual(getMovePath(grid, origin, { x: 4, y: 2 }, 3));
  });

  it('keeps the path when the target is out of range', () => {
    const grid = createGrid(5, 5, 'grass');
    const path = [origin, { x: 3, y: 2 }];
    expect(extendMovePath(grid, path, { x: 4, y: 4 }, 1)).toBe(path);
  });

  it('keeps the path when the target is out of bounds', () => {
    const grid = createGrid(5, 5, 'grass');
    const path = [origin];
    expect(extendMovePath(grid, path, { x: -1, y: 2 }, 3)).toBe(path);
  });

  it('never steps onto impassable terrain', () => {
    const grid = setTerrain(createGrid(5, 5, 'grass'), 3, 2, 'water');
    const path = [origin];
    expect(extendMovePath(grid, path, { x: 3, y: 2 }, 3)).toBe(path);
  });

  it('does not step onto a blocking unit', () => {
    const grid = setUnit(createGrid(5, 5, 'grass'), 3, 2, 'enemy');
    const path = [origin];
    expect(extendMovePath(grid, path, { x: 3, y: 2 }, 3)).toBe(path);
  });

  it('traces through units the mover may pass', () => {
    const grid = setUnit(createGrid(5, 5, 'grass'), 3, 2, 'ally');
    const options = { canPassThrough: (id: string) => id === 'ally' };
    let path = extendMovePath(grid, [origin], { x: 3, y: 2 }, 3, options);
    path = extendMovePath(grid, path, { x: 4, y: 2 }, 3, options);
    expect(path).toEqual([origin, { x: 3, y: 2 }, { x: 4, y: 2 }]);
  });

  it('respects terrain costs when extending', () => {
    const grid = setTerrain(createGrid(5, 5, 'grass'), 3, 2, 'forest');
    const options = { terrainCosts: { forest: 2 } };
    const path = extendMovePath(grid, [origin], { x: 3, y: 2 }, 1, options);
    expect(path).toEqual([origin]);
  });

  it('does not mutate the path it is given', () => {
    const grid = createGrid(5, 5, 'grass');
    const path = [origin];
    extendMovePath(grid, path, { x: 3, y: 2 }, 3);
    expect(path).toEqual([origin]);
  });
});

describe('canMoveAlongPath', () => {
  const range = [
    { x: 1, y: 1, cost: 0 },
    { x: 2, y: 1, cost: 1 },
    { x: 3, y: 1, cost: 2 },
  ];
  const path = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ];

  it('accepts the in-range tile the route ends on', () => {
    expect(canMoveAlongPath(range, path, { x: 3, y: 1 })).toBe(true);
  });

  it("accepts staying put on the mover's own tile", () => {
    expect(canMoveAlongPath(range, [{ x: 1, y: 1 }], { x: 1, y: 1 })).toBe(true);
  });

  it('rejects an in-range tile the route does not end on', () => {
    expect(canMoveAlongPath(range, path, { x: 2, y: 1 })).toBe(false);
  });

  it("rejects the route's end when it's out of range (e.g. an ally passed through)", () => {
    const throughAlly = [...path, { x: 4, y: 1 }];
    expect(canMoveAlongPath(range, throughAlly, { x: 4, y: 1 })).toBe(false);
  });

  it('rejects everything with an empty path or range', () => {
    expect(canMoveAlongPath(range, [], { x: 1, y: 1 })).toBe(false);
    expect(canMoveAlongPath([], path, { x: 3, y: 1 })).toBe(false);
  });

  it('agrees with getMovementRange and extendMovePath on a real map', () => {
    const grid = setUnit(createGrid(5, 3), 2, 1, 'ally');
    const options = { canPassThrough: (id: string) => id === 'ally' };
    const origin = { x: 0, y: 1 };
    const moveRange = getMovementRange(grid, origin, 3, options);
    const toAlly = extendMovePath(grid, [origin], { x: 2, y: 1 }, 3, options);
    expect(canMoveAlongPath(moveRange, toAlly, { x: 2, y: 1 })).toBe(false);
    const pastAlly = extendMovePath(grid, toAlly, { x: 3, y: 1 }, 3, options);
    expect(canMoveAlongPath(moveRange, pastAlly, { x: 3, y: 1 })).toBe(true);
  });
});
