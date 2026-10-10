import { describe, expect, it } from 'vitest';
import { PLAYER_ROSTER } from '../demoLevel.ts';
import { REGION_CONFIGS, REGION_SETTINGS } from '../../data/regions.ts';
import {
  createStageLevel,
  DEFAULT_ENEMY_CLASS,
  createStartingWarband,
  WARBAND_LEADER_NAME,
  WARBAND_MAX_DEPLOYED,
} from './stageLevel.ts';
import { getStageRegion } from './regions.ts';
import { LOOT_ITEMS } from '../loot.ts';
import { STARTING_CLASSES } from './startingClasses.ts';
import { calculateDamage, getAttackRange } from '../combat.ts';
import { countEnemies, getWalkingDistances, isInArea } from '../enemySpawns.ts';
import { findUnit, getCell, setUnit } from '../grid.ts';
import { getMovementRange } from '../movement.ts';
import { getBuildingSprites, getFeatureSprites } from '../mapArt.ts';
import { getReachable, terrainToRows } from '../mapGen.ts';
import { ROUT } from '../objectives.ts';
import { getCombatAward, getCombatExperience } from '../experience.ts';
import { BUILDING_ART, BUILDING_PALETTES, FOREST_ART, MOUNTAIN_ART } from '../tileset.ts';

const SEEDS = Array.from({ length: 50 }, (_, i) => i * 104729 + 3);
const [FIRST] = REGION_CONFIGS;

// Every region with every seed, for the checks each stage's battle must pass.
const BATTLES = REGION_CONFIGS.flatMap((region) =>
  SEEDS.map((seed) => ({ region, level: createStageLevel(seed, region) })),
);

describe('createStartingWarband', () => {
  it('starts with a single villager by default', () => {
    const warband = createStartingWarband();
    expect([...warband.keys()]).toEqual(['villager-1']);
    expect(warband.get('villager-1')!.name).toBe(WARBAND_LEADER_NAME);
    expect(warband.get('villager-1')!.unitClass).toBe('villager');
  });

  it('is a single unit of the chosen class', () => {
    for (const { id } of STARTING_CLASSES) {
      const warband = createStartingWarband(id);
      expect([...warband.keys()]).toEqual([`${id}-1`]);
      const unit = warband.get(`${id}-1`)!;
      expect(unit.name).toBe(Object.values(PLAYER_ROSTER)[0]);
      expect(unit.unitClass).toBe(id);
      expect(unit.team).toBe('player');
      expect(unit.level).toBe(1);
    }
  });

  it('names the unit as asked', () => {
    expect(createStartingWarband('archer', 'Wren').get('archer-1')!.name).toBe('Wren');
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

  it('is sized by its region and offers the starting warband', () => {
    for (const region of REGION_CONFIGS) {
      const level = createStageLevel(1, region);
      expect(level.grid.width).toBe(region.terrain.width);
      expect(level.grid.height).toBe(region.terrain.height);
    }
    const level = createStageLevel(1, FIRST);
    expect(level.roster).toEqual([...createStartingWarband().keys()]);
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

  it('makes a group’s enemies its class, soldiers when it sets none', () => {
    const level = createStageLevel(7, {
      ...FIRST,
      enemies: [{ count: 1, unitClass: 'villager' }, { count: 1, unitClass: 'archer' }, { count: 1 }],
    });
    const enemies = ['enemy-1', 'enemy-2', 'enemy-3'].map((unitId) => level.units.get(unitId)!);
    expect(enemies.map((unit) => unit.unitClass)).toEqual(['villager', 'archer', 'soldier']);
    expect(enemies.map((unit) => unit.name)).toEqual(['Enemy Villager', 'Enemy Archer', 'Enemy Soldier']);
    expect(enemies.every((unit) => unit.team === 'enemy')).toBe(true);
  });

  it('makes a group’s enemies level their killer up only when the group says so', () => {
    const level = createStageLevel(7, { ...FIRST, enemies: [{ count: 1, levelUpOnKill: true }, { count: 1 }] });
    expect(['enemy-1', 'enemy-2'].map((unitId) => level.units.get(unitId)!.levelUpOnKill)).toEqual([true, false]);
  });

  it('gives `lootCount` enemies an item to drop, keeping the map the same', () => {
    const region = { ...FIRST, enemies: [{ count: 3 }] };
    const plain = createStageLevel(11, region);
    const looted = createStageLevel(11, region, undefined, undefined, 1);
    expect([...plain.units.values()].some((unit) => unit.loot)).toBe(false);
    const carriers = [...looted.units.values()].filter((unit) => unit.loot);
    expect(carriers).toHaveLength(1);
    expect(carriers[0].team).toBe('enemy');
    expect(LOOT_ITEMS).toContain(carriers[0].loot);
    expect(terrainToRows(looted.grid)).toEqual(terrainToRows(plain.grid));
    expect(looted.grid.cells.map((c) => c.unitId)).toEqual(plain.grid.cells.map((c) => c.unitId));
    expect(looted.decorations).toEqual(plain.decorations);
  });

  it('starts a group’s enemies on its health, never past their max', () => {
    const level = createStageLevel(1, {
      ...FIRST,
      enemies: [{ count: 2, health: 4 }, { count: 1, health: 99 }, { count: 1 }],
    });
    const health = ['enemy-1', 'enemy-2', 'enemy-3', 'enemy-4'].map((unitId) => level.units.get(unitId)!);
    expect(health.map((unit) => unit.health)).toEqual([4, 4, health[2].maxHealth, health[3].maxHealth]);
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

describe('the stage ramp', () => {
  const enemyClasses = (stage: number) =>
    getStageRegion(stage, REGION_SETTINGS).enemies.flatMap((group) =>
      Array.from({ length: group.count }, () => group.unitClass ?? DEFAULT_ENEMY_CLASS),
    );

  it('goes from one slime, to one goblin, then mixes in more monsters', () => {
    expect(enemyClasses(1)).toEqual(['slime']);
    expect(enemyClasses(2)).toEqual(['goblin']);
    expect(enemyClasses(3)).toEqual(['slime', 'slime', 'goblin']);
    expect(enemyClasses(4)).toEqual(['goblin', 'goblin', 'skeleton']);
    expect(enemyClasses(5)).toEqual(['skeleton', 'skeleton', 'goblin', 'goblin']);
  });

  it('never fields fewer enemies than the stage before', () => {
    for (let stage = 2; stage <= REGION_CONFIGS.length + 1; stage++) {
      expect(enemyClasses(stage).length).toBeGreaterThanOrEqual(enemyClasses(stage - 1).length);
    }
  });
});

describe('stage 1', () => {
  const region = getStageRegion(1, REGION_SETTINGS);

  it('is a single slime, so the battle is over quickly and easily', () => {
    for (const seed of SEEDS) {
      const { units } = createStageLevel(seed, region);
      const enemies = [...units.values()].filter((unit) => unit.team === 'enemy');
      expect(enemies.map((unit) => unit.unitClass)).toEqual(['slime']);
    }
  });

  it('puts the enemy in reach on turn 1, from any deployment tile, whichever class the run starts as', () => {
    for (const { id } of STARTING_CLASSES) {
      for (const seed of SEEDS) {
        const level = createStageLevel(seed, region, createStartingWarband(id));
        const [unitId] = level.roster;
        const unit = level.units.get(unitId)!;
        const { minRange, maxRange } = unit.weapon!;
        const enemy = findUnit(level.grid, 'enemy-1')!;
        for (const tile of level.deploymentZone) {
          const grid = setUnit(level.grid, tile.x, tile.y, unitId);
          const inReach = getMovementRange(grid, tile, unit.movement).some((stop) =>
            getAttackRange(grid, stop, maxRange, minRange).some(({ x, y }) => x === enemy.x && y === enemy.y),
          );
          expect(inReach, `${id} on seed ${seed} from ${tile.x},${tile.y}`).toBe(true);
        }
      }
    }
  });

  it('is weak enough that any lone level-1 starting class wins the trade', () => {
    for (const { id } of STARTING_CLASSES) {
      const level = createStageLevel(1, region, createStartingWarband(id));
      const unit = level.units.get(level.roster[0])!;
      const enemy = level.units.get('enemy-1')!;
      expect(enemy.health).toBe(enemy.maxHealth);
      const hitsToKill = Math.ceil(enemy.maxHealth / calculateDamage(unit, enemy));
      const hitsToDie = Math.ceil(unit.maxHealth / Math.max(1, calculateDamage(enemy, unit)));
      expect(hitsToKill, id).toBeLessThanOrEqual(3);
      expect(hitsToDie, id).toBeGreaterThan(2 * hitsToKill);
    }
  });

  it('gives the usual XP for killing the enemy, not a guaranteed level up', () => {
    for (const { id } of STARTING_CLASSES) {
      const level = createStageLevel(1, region, createStartingWarband(id));
      const unit = level.units.get(level.roster[0])!;
      const enemy = level.units.get('enemy-1')!;
      expect(enemy.levelUpOnKill, id).toBe(false);
      expect(getCombatAward(unit, enemy, 'kill'), id).toEqual({
        amount: getCombatExperience(unit.level, enemy.level, 'kill'),
        scaled: true,
      });
    }
  });

  it('keeps the enemy off the deployment tiles’ doorstep', () => {
    for (const seed of SEEDS) {
      const { grid, deploymentZone } = createStageLevel(seed, region);
      const enemy = findUnit(grid, 'enemy-1')!;
      expect(getWalkingDistances(grid, deploymentZone).get(`${enemy.x},${enemy.y}`)).toBeGreaterThanOrEqual(3);
    }
  });
});
