import { describe, expect, it } from 'vitest';
import { PLAYER_ROSTER } from './demoLevel.ts';
import { createDungeonLevel, DUNGEON_ENEMY_COUNT, DUNGEON_MAP_SIZE, DUNGEON_MAX_DEPLOYED } from './dungeonLevel.ts';
import { findUnit, getCell } from './grid.ts';
import { getReachable, terrainToRows } from './mapGen.ts';

const SEEDS = Array.from({ length: 50 }, (_, i) => i * 104729 + 3);

describe('createDungeonLevel', () => {
  it('rebuilds the same battle from the same seed', () => {
    const a = createDungeonLevel(1234);
    const b = createDungeonLevel(1234);
    expect(terrainToRows(a.grid)).toEqual(terrainToRows(b.grid));
    expect(a.grid.cells.map((c) => c.unitId)).toEqual(b.grid.cells.map((c) => c.unitId));
    expect(a.decorations).toEqual(b.decorations);
  });

  it('builds different maps from different seeds', () => {
    const maps = new Set(SEEDS.map((seed) => terrainToRows(createDungeonLevel(seed).grid).join('\n')));
    expect(maps.size).toBeGreaterThan(1);
  });

  it('is sized DUNGEON_MAP_SIZE and offers the demo roster', () => {
    const level = createDungeonLevel(1);
    expect(level.grid.width).toBe(DUNGEON_MAP_SIZE.width);
    expect(level.grid.height).toBe(DUNGEON_MAP_SIZE.height);
    expect(level.roster).toEqual(Object.keys(PLAYER_ROSTER));
    expect(level.maxDeployed).toBe(DUNGEON_MAX_DEPLOYED);
    for (const unitId of level.roster) expect(findUnit(level.grid, unitId)).toBeNull();
  });

  it('deploys on three walkable tiles along the bottom row', () => {
    for (const seed of SEEDS) {
      const { grid, deploymentZone } = createDungeonLevel(seed);
      expect(deploymentZone).toHaveLength(3);
      for (const { x, y } of deploymentZone) {
        expect(y).toBe(grid.height - 1);
        expect(['grass', 'dirt']).toContain(getCell(grid, x, y)!.terrain);
      }
    }
  });

  it('places every enemy in the north third, where the player can walk to it', () => {
    for (const seed of SEEDS) {
      const { grid, units, deploymentZone } = createDungeonLevel(seed);
      const reachable = getReachable(grid, deploymentZone[1]);
      const enemies = [...units].filter(([, unit]) => unit.team === 'enemy');
      expect(enemies).toHaveLength(DUNGEON_ENEMY_COUNT);
      for (const [unitId] of enemies) {
        const tile = findUnit(grid, unitId)!;
        expect(tile.y).toBeLessThan(Math.floor(grid.height / 3));
        expect(reachable.has(`${tile.x},${tile.y}`)).toBe(true);
      }
    }
  });

  it('puts trees only on free grass, clear of units and deployment', () => {
    for (const seed of SEEDS) {
      const { grid, decorations, deploymentZone } = createDungeonLevel(seed);
      for (const { x, y, tree } of decorations) {
        expect(tree).toBe('green_ginkgo');
        expect(getCell(grid, x, y)!.terrain).toBe('grass');
        expect(getCell(grid, x, y)!.unitId).toBeNull();
        expect(deploymentZone).not.toContainEqual({ x, y });
      }
    }
  });
});
