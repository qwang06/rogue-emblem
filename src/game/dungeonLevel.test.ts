import { describe, expect, it } from 'vitest';
import { PLAYER_ROSTER } from './demoLevel.ts';
import { DUNGEON_CONFIGS } from '../data/dungeon.ts';
import { createDungeonLevel, DUNGEON_MAX_DEPLOYED } from './dungeonLevel.ts';
import { countEnemies, getWalkingDistances, isInRegion } from './enemySpawns.ts';
import { findUnit, getCell } from './grid.ts';
import { getBuildingSprites, getFeatureSprites } from './mapArt.ts';
import { getReachable, terrainToRows } from './mapGen.ts';
import { ROUT } from './objectives.ts';
import { BUILDING_ART, BUILDING_PALETTES, FOREST_ART, MOUNTAIN_ART } from './tileset.ts';

const SEEDS = Array.from({ length: 50 }, (_, i) => i * 104729 + 3);
const [FIRST] = DUNGEON_CONFIGS;

// Every config with every seed, for the checks each floor's battle must pass.
const BATTLES = DUNGEON_CONFIGS.flatMap((config) =>
  SEEDS.map((seed) => ({ config, level: createDungeonLevel(seed, config) })),
);

describe('createDungeonLevel', () => {
  it('rebuilds the same battle from the same seed', () => {
    const a = createDungeonLevel(1234, FIRST);
    const b = createDungeonLevel(1234, FIRST);
    expect(terrainToRows(a.grid)).toEqual(terrainToRows(b.grid));
    expect(a.grid.cells.map((c) => c.unitId)).toEqual(b.grid.cells.map((c) => c.unitId));
    expect(a.decorations).toEqual(b.decorations);
  });

  it('builds different maps from different seeds', () => {
    const maps = new Set(SEEDS.map((seed) => terrainToRows(createDungeonLevel(seed, FIRST).grid).join('\n')));
    expect(maps.size).toBeGreaterThan(1);
  });

  it('builds a different map from the same seed with a different config', () => {
    const maps = new Set(DUNGEON_CONFIGS.map((config) => terrainToRows(createDungeonLevel(7, config).grid).join('\n')));
    expect(maps.size).toBe(DUNGEON_CONFIGS.length);
  });

  it('is sized by its config and offers the demo roster', () => {
    for (const config of DUNGEON_CONFIGS) {
      const level = createDungeonLevel(1, config);
      expect(level.grid.width).toBe(config.terrain.width);
      expect(level.grid.height).toBe(config.terrain.height);
    }
    const level = createDungeonLevel(1, FIRST);
    expect(level.roster).toEqual(Object.keys(PLAYER_ROSTER));
    expect(level.maxDeployed).toBe(DUNGEON_MAX_DEPLOYED);
    for (const unitId of level.roster) expect(findUnit(level.grid, unitId)).toBeNull();
  });

  it('deploys on three walkable tiles along the bottom row', () => {
    for (const { level } of BATTLES) {
      const { grid, deploymentZone } = level;
      expect(deploymentZone).toHaveLength(3);
      for (const { x, y } of deploymentZone) {
        expect(y).toBe(grid.height - 1);
        expect(['grass', 'dirt']).toContain(getCell(grid, x, y)!.terrain);
      }
    }
  });

  it('places every built-in floor enemy within its group, where the player can walk to it', () => {
    for (const { config, level } of BATTLES) {
      const { grid, units, deploymentZone } = level;
      const reachable = getReachable(grid, deploymentZone[1]);
      const enemies = [...units].filter(([, unit]) => unit.team === 'enemy');
      expect(enemies).toHaveLength(countEnemies(config.enemies));
      // Units are numbered in group order, so the first group's come first.
      const groupOf = config.enemies.flatMap((group) => Array.from({ length: group.count }, () => group));
      enemies.forEach(([unitId], i) => {
        const tile = findUnit(grid, unitId)!;
        expect(isInRegion(tile, groupOf[i].region ?? {}, grid.width, grid.height)).toBe(true);
        expect(reachable.has(`${tile.x},${tile.y}`)).toBe(true);
      });
    }
  });

  it('places enemies by their groups’ distances from the deployment zone', () => {
    const config = {
      ...FIRST,
      enemies: [
        { count: 2, minDistance: 12 },
        { count: 2, minDistance: 3, maxDistance: 5 },
      ],
    };
    for (const seed of SEEDS) {
      const { grid, deploymentZone } = createDungeonLevel(seed, config);
      const distances = getWalkingDistances(grid, deploymentZone);
      const steps = (unitId: string) => distances.get(`${findUnit(grid, unitId)!.x},${findUnit(grid, unitId)!.y}`)!;
      for (const unitId of ['enemy-1', 'enemy-2']) expect(steps(unitId)).toBeGreaterThanOrEqual(12);
      for (const unitId of ['enemy-3', 'enemy-4']) {
        expect(steps(unitId)).toBeGreaterThanOrEqual(3);
        expect(steps(unitId)).toBeLessThanOrEqual(5);
      }
    }
  });

  it('places fewer enemies when a group asks for more than fit', () => {
    const level = createDungeonLevel(1, { ...FIRST, enemies: [{ count: 3, minDistance: 100 }] });
    expect([...level.units.values()].filter((unit) => unit.team === 'enemy')).toEqual([]);
  });

  it('puts trees only on free grass, clear of units, deployment and other art', () => {
    for (const { config, level } of BATTLES) {
      const { grid, decorations, deploymentZone, buildings = [] } = level;
      const art = [
        ...getBuildingSprites(buildings, BUILDING_PALETTES[config.palette], BUILDING_ART),
        ...getFeatureSprites(grid, FOREST_ART, MOUNTAIN_ART),
      ];
      for (const { x, y, tree } of decorations) {
        expect(tree).toBe('green_ginkgo');
        expect(getCell(grid, x, y)!.terrain).toBe('grass');
        expect(getCell(grid, x, y)!.unitId).toBeNull();
        expect(deploymentZone).not.toContainEqual({ x, y });
        expect(art.filter((s) => s.x === x && s.y === y)).toEqual([]);
      }
    }
  });

  it('draws each dungeon in its config palette, with the generated buildings', () => {
    for (const { config, level } of BATTLES) {
      expect(level.palette).toBe(config.palette);
      expect(level.buildings!.length).toBeGreaterThan(0);
    }
  });
});

describe('dungeon objectives', () => {
  it('is a rout unless the config sets its own objective', () => {
    for (const config of DUNGEON_CONFIGS) {
      expect(createDungeonLevel(1, config).objective).toEqual(config.objective ?? ROUT);
    }
    const special = { ...DUNGEON_CONFIGS[0], objective: { kind: 'rout' } as const };
    expect(createDungeonLevel(1, special).objective).toBe(special.objective);
  });
});
