import { describe, expect, it } from 'vitest';
import { getConfigFloors, getDungeonConfig, getDungeonFloor, type DungeonConfig } from './dungeonConfigs.ts';

const config = (name: string): DungeonConfig => ({
  name,
  terrain: { width: 8, height: 8 },
  enemies: [{ count: 1 }],
  treeChance: 0,
  palette: 'a-stone',
});
const [A, B, C] = ['a', 'b', 'c'].map(config);

describe('getDungeonConfig', () => {
  it('moves to the next config every floor by default', () => {
    expect([1, 2, 3].map((floor) => getDungeonConfig(floor, [A, B, C]))).toEqual([A, B, C]);
  });

  it('shares a config across floorsPerConfig floors in a row', () => {
    const floors = [1, 2, 3, 4, 5, 6].map((floor) => getDungeonConfig(floor, [A, B, C], 2));
    expect(floors).toEqual([A, A, B, B, C, C]);
  });

  it('sticks on the last config once they run out', () => {
    expect(getDungeonConfig(4, [A, B])).toBe(B);
    expect(getDungeonConfig(100, [A, B], 3)).toBe(B);
    expect(getDungeonConfig(1000, [A, B, C])).toBe(C);
  });

  it('works with a single config', () => {
    expect(getDungeonConfig(1, [A])).toBe(A);
    expect(getDungeonConfig(9, [A])).toBe(A);
  });

  it('rejects floors below 1 or between whole numbers', () => {
    expect(() => getDungeonConfig(0, [A])).toThrow();
    expect(() => getDungeonConfig(-1, [A])).toThrow();
    expect(() => getDungeonConfig(1.5, [A])).toThrow();
  });

  it('rejects an empty config list and floorsPerConfig below 1', () => {
    expect(() => getDungeonConfig(1, [])).toThrow();
    expect(() => getDungeonConfig(1, [A], 0)).toThrow();
    expect(() => getDungeonConfig(1, [A], 1.5)).toThrow();
  });
});

describe('getDungeonFloor', () => {
  it('uses the settings it is given', () => {
    const settings = { floorsPerConfig: 2, floors: [config('A'), config('B')] };
    expect(getDungeonFloor(2, settings).name).toBe('A');
    expect(getDungeonFloor(3, settings).name).toBe('B');
    expect(getDungeonFloor(99, settings).name).toBe('B');
  });
});

describe('getConfigFloors', () => {
  it('gives each config its stretch of floors', () => {
    expect(getConfigFloors(0, 3, 1)).toEqual({ first: 1, last: 1 });
    expect(getConfigFloors(1, 3, 2)).toEqual({ first: 3, last: 4 });
  });

  it('leaves the last config open-ended', () => {
    expect(getConfigFloors(2, 3, 2)).toEqual({ first: 5, last: null });
    expect(getConfigFloors(0, 1, 1)).toEqual({ first: 1, last: null });
  });
});
