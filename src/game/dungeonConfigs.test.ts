import { describe, expect, it } from 'vitest';
import { DUNGEON_CONFIGS, DUNGEON_FLOORS_PER_CONFIG, getDungeonConfig, type DungeonConfig } from './dungeonConfigs.ts';
import { BUILDING_PALETTES } from './tileset.ts';

const config = (name: string): DungeonConfig => ({
  name,
  terrain: { width: 8, height: 8 },
  enemyCount: 1,
  treeChance: 0,
  palette: 'a-stone',
});
const [A, B, C] = ['a', 'b', 'c'].map(config);

describe('getDungeonConfig', () => {
  it('moves to the next config every floor by default', () => {
    expect(DUNGEON_FLOORS_PER_CONFIG).toBe(1);
    expect(getDungeonConfig(1)).toBe(DUNGEON_CONFIGS[0]);
    expect(getDungeonConfig(2)).toBe(DUNGEON_CONFIGS[1]);
    expect(getDungeonConfig(DUNGEON_CONFIGS.length)).toBe(DUNGEON_CONFIGS.at(-1));
  });

  it('shares a config across floorsPerConfig floors in a row', () => {
    const floors = [1, 2, 3, 4, 5, 6].map((floor) => getDungeonConfig(floor, [A, B, C], 2));
    expect(floors).toEqual([A, A, B, B, C, C]);
  });

  it('sticks on the last config once they run out', () => {
    expect(getDungeonConfig(4, [A, B])).toBe(B);
    expect(getDungeonConfig(100, [A, B], 3)).toBe(B);
    expect(getDungeonConfig(1000)).toBe(DUNGEON_CONFIGS.at(-1));
  });

  it('works with a single config', () => {
    expect(getDungeonConfig(1, [A])).toBe(A);
    expect(getDungeonConfig(9, [A])).toBe(A);
  });

  it('rejects floors below 1 or between whole numbers', () => {
    expect(() => getDungeonConfig(0)).toThrow();
    expect(() => getDungeonConfig(-1)).toThrow();
    expect(() => getDungeonConfig(1.5)).toThrow();
  });

  it('rejects an empty config list and floorsPerConfig below 1', () => {
    expect(() => getDungeonConfig(1, [])).toThrow();
    expect(() => getDungeonConfig(1, [A], 0)).toThrow();
    expect(() => getDungeonConfig(1, [A], 1.5)).toThrow();
  });
});

describe('DUNGEON_CONFIGS', () => {
  it('has uniquely named configs with usable settings', () => {
    expect(DUNGEON_CONFIGS.length).toBeGreaterThan(1);
    expect(new Set(DUNGEON_CONFIGS.map((c) => c.name)).size).toBe(DUNGEON_CONFIGS.length);
    for (const { terrain, enemyCount, treeChance, palette } of DUNGEON_CONFIGS) {
      expect(terrain.width).toBeGreaterThanOrEqual(3);
      expect(terrain.height).toBeGreaterThanOrEqual(3);
      expect(enemyCount).toBeGreaterThan(0);
      expect(treeChance).toBeGreaterThanOrEqual(0);
      expect(treeChance).toBeLessThanOrEqual(1);
      expect(BUILDING_PALETTES).toHaveProperty(palette);
    }
  });
});
