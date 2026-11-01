import { describe, expect, it } from 'vitest';
import { createGrid, setTerrain, setUnit } from './grid.ts';
import {
  addMine,
  canBreach,
  canLayMineOn,
  findTrippedMine,
  getMineDamage,
  removeMine,
  type Mine,
} from './terrainSkills.ts';

const mine = (x: number, y: number, team: Mine['team'] = 'player'): Mine => ({ x, y, team, damage: 6 });

describe('canBreach', () => {
  it('knocks down walls and rock, nothing else', () => {
    expect(canBreach('wall')).toBe(true);
    expect(canBreach('mountain')).toBe(true);
    expect(canBreach('water')).toBe(false);
    expect(canBreach('grass')).toBe(false);
    expect(canBreach(null)).toBe(false);
  });
});

describe('canLayMineOn', () => {
  it('needs an empty, in-bounds tile of walkable ground', () => {
    let grid = setUnit(createGrid(3, 1, 'grass'), 0, 0, 'a');
    grid = setTerrain(grid, 2, 0, 'water');
    const walkable = (terrain: string | null) => terrain !== 'water';
    expect(canLayMineOn(grid, { x: 1, y: 0 }, walkable)).toBe(true);
    expect(canLayMineOn(grid, { x: 0, y: 0 }, walkable)).toBe(false);
    expect(canLayMineOn(grid, { x: 2, y: 0 }, walkable)).toBe(false);
    expect(canLayMineOn(grid, { x: 3, y: 0 }, walkable)).toBe(false);
  });
});

describe('addMine and removeMine', () => {
  it('keeps one mine a tile', () => {
    const mines = addMine(addMine([], mine(1, 1)), { ...mine(1, 1), damage: 9 });
    expect(mines).toEqual([{ ...mine(1, 1), damage: 9 }]);
    expect(removeMine(addMine(mines, mine(2, 2)), { x: 1, y: 1 })).toEqual([mine(2, 2)]);
  });
});

describe('findTrippedMine', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ];

  it("is the first foe's mine on the path past the walker's own tile", () => {
    expect(findTrippedMine([mine(2, 0), mine(1, 0)], path, 'enemy')).toEqual(mine(1, 0));
    expect(findTrippedMine([mine(0, 0)], path, 'enemy')).toBeNull();
  });

  it("never trips the walker's own side's mines", () => {
    expect(findTrippedMine([mine(1, 0)], path, 'player')).toBeNull();
    expect(findTrippedMine([mine(1, 0)], path, 'guest')).toBeNull();
  });
});

describe('getMineDamage', () => {
  it('deals its damage but never the last HP', () => {
    expect(getMineDamage({ damage: 6 }, 20)).toBe(6);
    expect(getMineDamage({ damage: 6 }, 4)).toBe(3);
    expect(getMineDamage({ damage: 6 }, 1)).toBe(0);
  });
});
