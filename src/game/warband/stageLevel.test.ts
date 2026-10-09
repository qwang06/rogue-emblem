import { describe, expect, it } from 'vitest';
import { PLAYER_ROSTER } from '../demoLevel.ts';
import { REGION_CONFIGS } from '../../data/regions.ts';
import { createStageLevel, createStartingWarband, WARBAND_MAX_DEPLOYED } from './stageLevel.ts';
import { STARTING_CLASSES } from './startingClasses.ts';
import { countEnemies, getWalkingDistances, isInArea } from '../enemySpawns.ts';
import { findUnit, getCell } from '../grid.ts';
import { getBuildingSprites, getFeatureSprites } from '../mapArt.ts';
import { getReachable, terrainToRows } from '../mapGen.ts';
import { ROUT } from '../objectives.ts';
import { BUILDING_ART, BUILDING_PALETTES, FOREST_ART, MOUNTAIN_ART } from '../tileset.ts';

const SEEDS = Array.from({ length: 50 }, (_, i) => i * 104729 + 3);
const [FIRST] = REGION_CONFIGS;

// Every region with every seed, for the checks each stage's battle must pass.
const BATTLES = REGION_CONFIGS.flatMap((region) =>
  SEEDS.map((seed) => ({ region, level: createStageLevel(seed, region) })),
);

describe('createStartingWarband', () => {
  it('starts with the demo roster as villagers by default', () => {
    const warband = createStartingWarband();
    expect([...warband.keys()]).toEqual(['villager-1', 'villager-2', 'villager-3']);
    expect([...warband.values()].map((u) => u.name)).toEqual(Object.values(PLAYER_ROSTER));
    expect([...warband.values()].every((u) => u.unitClass === 'villager')).toBe(true);
  });

  it('builds the warband from the chosen class', () => {
    for (const { id } of STARTING_CLASSES) {
      const warband = createStartingWarband(id);
      expect([...warband.keys()]).toEqual([`${id}-1`, `${id}-2`, `${id}-3`]);
      for (const unit of warband.values()) {
        expect(unit.unitClass).toBe(id);
        expect(unit.team).toBe('player');
        expect(unit.level).toBe(1);
      }
    }
  });

  it('gives each call fresh units', () => {
    const a = createStartingWarband('soldier').get('soldier-1')!;
    a.takeDamage(3);
    expect(createStartingWarband('soldier').get('soldier-1')!.health).toBe(a.maxHealth);
  });

  it('rejects an unknown class', () => {
    expect(() => createStartingWarband('dragon')).toThrow(/dragon/);
  });
});

describe('createStageLevel', () => {
  it('rebuilds the same battle from the same seed', () => {
    const a = createStageLevel(1234, FIRST);
    const b = createStageLevel(1234, FIRST);
    expect(terrainToRows(a.grid)).toEqual(terrainToRows(b.grid));
    expect(a.grid.cells.map((c) => c.unitId)).toEqual(b.grid.cells.map((c) => c.unitId));
    expect(a.decorations).toEqual(b.decorations);
  });

  it('builds different maps from different seeds', () => {
    const maps = new Set(SEEDS.map((seed) => terrainToRows(createStageLevel(seed, FIRST).grid).join('\n')));
    expect(maps.size).toBeGreaterThan(1);
  });

  it('builds a different map from the same seed with a different region', () => {
    const maps = new Set(REGION_CONFIGS.map((region) => terrainToRows(createStageLevel(7, region).grid).join('\n')));
    expect(maps.size).toBe(REGION_CONFIGS.length);
  });

  it('is sized by its region and offers the demo roster', () => {
    for (const region of REGION_CONFIGS) {
      const level = createStageLevel(1, region);
      expect(level.grid.width).toBe(region.terrain.width);
      expect(level.grid.height).toBe(region.terrain.height);
    }
    const level = createStageLevel(1, FIRST);
    expect(level.roster).toEqual(Object.keys(PLAYER_ROSTER));
    expect(level.maxDeployed).toBe(WARBAND_MAX_DEPLOYED);
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

  it('places every built-in region enemy within its group, where the player can walk to it', () => {
    for (const { region, level } of BATTLES) {
      const { grid, units, deploymentZone } = level;
      const reachable = getReachable(grid, deploymentZone[1]);
      const enemies = [...units].filter(([, unit]) => unit.team === 'enemy');
      expect(enemies).toHaveLength(countEnemies(region.enemies));
      // Units are numbered in group order, so the first group's come first.
      const groupOf = region.enemies.flatMap((group) => Array.from({ length: group.count }, () => group));
      enemies.forEach(([unitId], i) => {
        const tile = findUnit(grid, unitId)!;
        expect(isInArea(tile, groupOf[i].area ?? {}, grid.width, grid.height)).toBe(true);
        expect(reachable.has(`${tile.x},${tile.y}`)).toBe(true);
      });
    }
  });

  it('places enemies by their groups’ distances from the deployment zone', () => {
    const region = {
      ...FIRST,
      enemies: [
        { count: 2, minDistance: 12 },
        { count: 2, minDistance: 3, maxDistance: 5 },
      ],
    };
    for (const seed of SEEDS) {
      const { grid, deploymentZone } = createStageLevel(seed, region);
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
    const level = createStageLevel(1, { ...FIRST, enemies: [{ count: 3, minDistance: 100 }] });
    expect([...level.units.values()].filter((unit) => unit.team === 'enemy')).toEqual([]);
  });

  it('puts trees only on free grass, clear of units, deployment and other art', () => {
    for (const { region, level } of BATTLES) {
      const { grid, decorations, deploymentZone, buildings = [] } = level;
      const art = [
        ...getBuildingSprites(buildings, BUILDING_PALETTES[region.palette], BUILDING_ART),
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

  it('draws each stage in its region palette, with the generated buildings', () => {
    for (const { region, level } of BATTLES) {
      expect(level.palette).toBe(region.palette);
      expect(level.buildings!.length).toBeGreaterThan(0);
    }
  });
});

describe('stage objectives', () => {
  it('is a rout unless the region sets its own objective', () => {
    for (const region of REGION_CONFIGS) {
      expect(createStageLevel(1, region).objective).toEqual(region.objective ?? ROUT);
    }
    const special = { ...REGION_CONFIGS[0], objective: { kind: 'rout' } as const };
    expect(createStageLevel(1, special).objective).toBe(special.objective);
  });
});
