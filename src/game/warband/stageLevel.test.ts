import { describe, expect, it } from 'vitest';
import { PLAYER_ROSTER } from '../demoLevel.ts';
import { REGION_CONFIGS, REGION_SETTINGS } from '../../data/regions.ts';
import {
  createStageLevel,
  DEFAULT_ENEMY_CLASS,
  createStartingWarband,
  getCandidateSeeds,
  growToLevel,
  layOutStage,
  MAP_CANDIDATES,
  pickStageArchetype,
  pickStageLayout,
  SPIKE_TRAP_COUNT,
  SPIKE_TRAP_REACH,
  withArchetype,
  WARBAND_LEADER_NAME,
  WARBAND_MAX_DEPLOYED,
} from './stageLevel.ts';
import { getStageRegion } from './regions.ts';
import { LOOT_ITEMS } from '../loot.ts';
import { ALL_STARTING_CLASSES, STARTING_CLASSES, UNLOCKABLE_STARTING_CLASSES } from './startingClasses.ts';
import { createUnitOfClass } from '../unitClasses.ts';
import { calculateDamage, getAttackRange } from '../combat.ts';
import { countEnemies, getWalkingDistances, isInArea } from '../enemySpawns.ts';
import { findUnit, getCell, getDistance, setUnit } from '../grid.ts';
import { SPIKES } from '../hazards.ts';
import { getMovementRange } from '../movement.ts';
import { getBuildingSprites, getFeatureSprites } from '../mapArt.ts';
import { getReachable, terrainToRows } from '../mapGen.ts';
import { OBJECTIVE_KINDS, ROUT } from '../objectives.ts';
import { getCombatAward, getCombatExperience } from '../experience.ts';
import { BUILDING_ART, BUILDING_PALETTES, FOREST_ART, MOUNTAIN_ART } from '../tileset.ts';

const SEEDS = Array.from({ length: 50 }, (_, i) => i * 104729 + 3);
const [FIRST] = REGION_CONFIGS;

// Every region with every seed, for the checks each stage's battle must pass.
const BATTLES = REGION_CONFIGS.flatMap((region) =>
  SEEDS.map((seed) => ({ region, level: createStageLevel(seed, region) })),
);

describe('createStartingWarband', () => {
  it('starts with a single warrior by default', () => {
    const warband = createStartingWarband();
    expect([...warband.keys()]).toEqual(['warrior-1']);
    expect(warband.get('warrior-1')!.name).toBe(WARBAND_LEADER_NAME);
    expect(warband.get('warrior-1')!.unitClass).toBe('warrior');
  });

  it('is a single unit of the chosen class', () => {
    for (const { id } of ALL_STARTING_CLASSES) {
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

describe('growToLevel', () => {
  it('levels a unit up on its average growths, the same every time', () => {
    const grow = () => {
      const unit = createUnitOfClass('soldier', { team: 'enemy' });
      growToLevel(unit, 9);
      return unit;
    };
    const unit = grow();
    // Soldier: 10 HP 70%, 4 STR 45%, 2 DEF 30% → +5, +3, +2 over 8 level ups.
    expect([unit.level, unit.maxHealth, unit.strength, unit.defense]).toEqual([9, 15, 7, 4]);
    expect(grow()).toEqual(unit);
  });

  it('does nothing at or above the level', () => {
    const unit = createUnitOfClass('soldier', { team: 'enemy' });
    growToLevel(unit, 1);
    growToLevel(unit, 0);
    expect([unit.level, unit.maxHealth]).toEqual([1, 10]);
  });
});

describe('getCandidateSeeds', () => {
  it('starts with the seed itself and gives as many seeds as asked', () => {
    const seeds = getCandidateSeeds(1234);
    expect(seeds).toHaveLength(MAP_CANDIDATES);
    expect(seeds[0]).toBe(1234);
    expect(getCandidateSeeds(1234, 1)).toEqual([1234]);
  });

  it('is the same for the same seed, and differs between seeds', () => {
    expect(getCandidateSeeds(1234)).toEqual(getCandidateSeeds(1234));
    expect(getCandidateSeeds(1234).slice(1)).not.toEqual(getCandidateSeeds(1235).slice(1));
    expect(new Set(getCandidateSeeds(1234)).size).toBe(MAP_CANDIDATES);
  });
});

// Lays out many full-size stages, each the best of MAP_CANDIDATES maps.
describe('pickStageLayout', { timeout: 60_000 }, () => {
  it('keeps the best-scoring candidate that keeps every rule, the earliest on a tie', () => {
    for (const region of REGION_CONFIGS) {
      for (const seed of SEEDS.slice(0, 10)) {
        const layouts = getCandidateSeeds(seed).map((s) => layOutStage(s, region));
        const valid = layouts.filter((l) => l.problems.length === 0);
        const picked = pickStageLayout(seed, region);
        const best = Math.min(...valid.map((l) => l.score));
        expect(picked.problems).toEqual([]);
        expect(picked.score).toBe(best);
        expect(picked.seed).toBe(valid.find((l) => l.score === best)!.seed);
      }
    }
  });

  it('never keeps a map that breaks a rule when another candidate keeps them all', () => {
    for (const region of REGION_CONFIGS) {
      for (const seed of SEEDS) expect(pickStageLayout(seed, region).problems).toEqual([]);
    }
  });

  it('keeps a lone candidate whatever rules it breaks', () => {
    const picked = pickStageLayout(1234, FIRST, 1);
    expect(picked).toMatchObject({ seed: 1234, problems: layOutStage(1234, FIRST).problems });
  });

  it('lays out only the seed itself with one candidate', () => {
    const picked = pickStageLayout(1234, FIRST, 1);
    expect(picked.seed).toBe(1234);
    expect(terrainToRows(picked.terrain.grid)).toEqual(terrainToRows(layOutStage(1234, FIRST).terrain.grid));
  });

  it('never picks a worse map than the seed alone would give', () => {
    for (const region of REGION_CONFIGS) {
      for (const seed of SEEDS) {
        const own = layOutStage(seed, region);
        if (own.problems.length > 0) continue;
        expect(pickStageLayout(seed, region).score).toBeLessThanOrEqual(own.score);
      }
    }
  });
});

// Lays out many full-size stages, each the best of MAP_CANDIDATES maps.
describe('createStageLevel', { timeout: 60_000 }, () => {
  it('builds the map pickStageLayout picks, with enemies on its tiles', () => {
    for (const region of REGION_CONFIGS) {
      const layout = pickStageLayout(1234, region);
      const level = createStageLevel(1234, region);
      expect(terrainToRows(level.grid)).toEqual(terrainToRows(layout.terrain.grid));
      expect(level.deploymentZone).toEqual(layout.deploymentZone);
      layout.enemyTiles.flat().forEach((tile, i) => expect(findUnit(level.grid, `enemy-${i + 1}`)).toEqual(tile));
    }
  });

  it('lets every built-in region fight within the first turn or two', () => {
    // Most units move 5 and strike 1 tile away, so an enemy 11 or fewer
    // steps out can be struck by turn 2.
    for (const region of REGION_CONFIGS) {
      for (const seed of SEEDS) {
        const { metrics } = pickStageLayout(seed, region);
        expect(metrics.nearestEnemy).not.toBeNull();
        expect(metrics.nearestEnemy!).toBeLessThanOrEqual(11);
      }
    }
  });

  it('rebuilds the same battle from the same seed', () => {
    const a = createStageLevel(1234, FIRST);
    const b = createStageLevel(1234, FIRST);
    expect(terrainToRows(a.grid)).toEqual(terrainToRows(b.grid));
    expect(a.grid.cells.map((c) => c.unitId)).toEqual(b.grid.cells.map((c) => c.unitId));
    expect(a.decorations).toEqual(b.decorations);
  });

  it('lays a few spike traps on some maps, near the enemies and off the deployment zone', () => {
    const withTraps = BATTLES.filter(({ level }) => level.grid.cells.some((c) => c.terrain === SPIKES));
    expect(withTraps.length).toBeGreaterThan(BATTLES.length * 0.3);
    expect(withTraps.length).toBeLessThan(BATTLES.length * 0.7);
    for (const { level } of withTraps) {
      const traps = level.grid.cells.filter((c) => c.terrain === SPIKES);
      expect(traps.length).toBeLessThanOrEqual(SPIKE_TRAP_COUNT.max);
      const enemies = level.grid.cells.filter((c) => c.unitId?.startsWith('enemy-'));
      for (const trap of traps) {
        expect(trap.unitId).toBeNull();
        expect(level.deploymentZone.some((tile) => getDistance(tile, trap) <= 1)).toBe(false);
        expect(level.decorations.some((tree) => getDistance(tree, trap) <= 1)).toBe(false);
        expect(enemies.some((enemy) => getDistance(enemy, trap) <= SPIKE_TRAP_REACH)).toBe(true);
      }
    }
  });

  it('builds different maps from different seeds', () => {
    const maps = new Set(SEEDS.map((seed) => terrainToRows(createStageLevel(seed, FIRST).grid).join('\n')));
    expect(maps.size).toBeGreaterThan(1);
  });

  it('builds a different map from the same seed with a different region', () => {
    // Regions with the same dressing can share a map; most don't.
    const maps = new Set(REGION_CONFIGS.map((region) => terrainToRows(createStageLevel(7, region).grid).join('\n')));
    expect(maps.size).toBeGreaterThan(REGION_CONFIGS.length / 2);
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

  it('provides five walkable deployment tiles, with the original three down the west edge', () => {
    for (const { level } of BATTLES) {
      const { grid, deploymentZone } = level;
      expect(deploymentZone).toHaveLength(5);
      for (const { x } of deploymentZone.slice(0, 3)) {
        expect(x).toBe(0);
      }
      for (const { x, y } of deploymentZone) {
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
        { count: 2, minDistance: 6 },
        { count: 2, minDistance: 3, maxDistance: 5 },
      ],
    };
    for (const seed of SEEDS) {
      const { grid, deploymentZone } = createStageLevel(seed, region);
      const distances = getWalkingDistances(grid, deploymentZone);
      const steps = (unitId: string) => distances.get(`${findUnit(grid, unitId)!.x},${findUnit(grid, unitId)!.y}`)!;
      for (const unitId of ['enemy-1', 'enemy-2']) expect(steps(unitId)).toBeGreaterThanOrEqual(6);
      for (const unitId of ['enemy-3', 'enemy-4']) {
        expect(steps(unitId)).toBeGreaterThanOrEqual(3);
        expect(steps(unitId)).toBeLessThanOrEqual(5);
      }
    }
  });

  it('makes a group’s enemies its class, soldiers when it sets none', () => {
    const level = createStageLevel(7, {
      ...FIRST,
      enemies: [{ count: 1, unitClass: 'warrior' }, { count: 1, unitClass: 'archer' }, { count: 1 }],
    });
    const enemies = ['enemy-1', 'enemy-2', 'enemy-3'].map((unitId) => level.units.get(unitId)!);
    expect(enemies.map((unit) => unit.unitClass)).toEqual(['warrior', 'archer', 'soldier']);
    expect(enemies.map((unit) => unit.name)).toEqual(['Enemy Warrior', 'Enemy Archer', 'Enemy Soldier']);
    expect(enemies.every((unit) => unit.team === 'enemy')).toBe(true);
  });

  it('makes a group’s enemies level their killer up only when the group says so', () => {
    const level = createStageLevel(7, { ...FIRST, enemies: [{ count: 1, levelUpOnKill: true }, { count: 1 }] });
    expect(['enemy-1', 'enemy-2'].map((unitId) => level.units.get(unitId)!.levelUpOnKill)).toEqual([true, false]);
  });

  it('fields a group’s enemies at its level, on average growths', () => {
    const level = createStageLevel(7, {
      ...FIRST,
      enemies: [
        { count: 1, unitClass: 'orc', level: 5 },
        { count: 1, unitClass: 'orc' },
      ],
    });
    const [grown, plain] = ['enemy-1', 'enemy-2'].map((unitId) => level.units.get(unitId)!);
    expect([grown.level, plain.level]).toEqual([5, 1]);
    // Orc: 14 HP at 80%, 5 STR at 55% → +3.2 and +2.2 over 4 level ups.
    expect([grown.maxHealth, grown.health, grown.strength]).toEqual([17, 17, 7]);
    expect([plain.maxHealth, plain.strength]).toEqual([14, 5]);
  });

  it('makes the first enemy of a group that names a boss into that boss', () => {
    const level = createStageLevel(7, {
      ...FIRST,
      enemies: [
        { count: 1, unitClass: 'goblin' },
        { count: 2, unitClass: 'orc', boss: 'Orc Warlord' },
      ],
    });
    expect(level.bossUnitId).toBe('enemy-2');
    const units = ['enemy-1', 'enemy-2', 'enemy-3'].map((unitId) => level.units.get(unitId)!);
    expect(units.map((unit) => unit.name)).toEqual(['Enemy Goblin', 'Orc Warlord', 'Enemy Orc']);
    expect(units.map((unit) => unit.holdsPosition)).toEqual([false, true, false]);
    expect(createStageLevel(7, FIRST).bossUnitId).toBeUndefined();
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

  it('draws each stage in its region palette, on its battlefield with the scattered obstacles', () => {
    for (const { region, level } of BATTLES) {
      expect(level.palette).toBe(region.palette);
      expect(level.battlefield).toBe(region.terrain.battlefield);
      expect(level.obstacles!.length).toBeGreaterThan(0);
      expect(level.buildings).toEqual([]);
    }
  });
});

describe('stage objectives', () => {
  it('is a rout until battleSetup places the stage’s own (stageObjective.ts)', () => {
    const special = { ...REGION_CONFIGS[0], objective: { kind: 'seize' } as const };
    expect(createStageLevel(1, special).objective).toBe(ROUT);
  });
});

describe('the stage ramp', () => {
  const enemyClasses = (stage: number) =>
    getStageRegion(stage, REGION_SETTINGS).enemies.flatMap((group) =>
      Array.from({ length: group.count }, () => group.unitClass ?? DEFAULT_ENEMY_CLASS),
    );

  const enemyLevels = (stage: number) =>
    getStageRegion(stage, REGION_SETTINGS).enemies.flatMap((group) =>
      Array.from({ length: group.count }, () => group.level ?? 1),
    );

  it('goes from one slime, to two goblins, then mixes in more monsters', () => {
    expect(enemyClasses(1)).toEqual(['slime']);
    expect(enemyClasses(2)).toEqual(['goblin', 'goblin']);
    expect(enemyClasses(3)).toEqual(['slime', 'slime', 'wolf']);
    expect(enemyClasses(4)).toEqual(['goblin', 'goblin', 'skeleton']);
    expect(enemyClasses(5)).toEqual(['skeleton', 'skeleton', 'bat', 'bat']);
  });

  it('brings in the brigands on stage 8 and the orcs on stage 9', () => {
    expect(enemyClasses(8)).toEqual(['soldier', 'archer', 'vanguard', 'goblin', 'goblin']);
    expect(enemyClasses(9)).toContain('orc');
    expect([1, 2, 3, 4, 5, 6, 7, 8].some((stage) => enemyClasses(stage).includes('orc'))).toBe(false);
  });

  it('never fields weaker enemies than the stage before', () => {
    const top = (stage: number) => Math.max(...enemyLevels(stage));
    for (let stage = 2; stage <= REGION_SETTINGS.finalStage!; stage++) {
      expect(top(stage)).toBeGreaterThanOrEqual(top(stage - 1));
    }
  });

  it('ends the run on stage 10, a boss fight against the Orc Warlord', () => {
    expect(REGION_SETTINGS.finalStage).toBe(10);
    const finale = getStageRegion(10, REGION_SETTINGS);
    expect(finale.objective).toEqual({ kind: 'boss' });
    expect(finale.enemies.filter((group) => group.boss).map((group) => group.boss)).toEqual(['Orc Warlord']);
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

  it('puts the enemy in reach on turn 1, from any deployment tile, whichever base class the run starts as', () => {
    for (const { id } of STARTING_CLASSES) {
      for (const seed of SEEDS) {
        const level = createStageLevel(seed, region, createStartingWarband(id));
        const [unitId] = level.roster;
        const unit = level.units.get(unitId)!;
        const { minRange, maxRange } = unit.weapon!;
        const enemy = findUnit(level.grid, 'enemy-1')!;
        for (const tile of level.deploymentZone.slice(0, 3)) {
          const grid = setUnit(level.grid, tile.x, tile.y, unitId);
          const inReach = getMovementRange(grid, tile, unit.movement).some((stop) =>
            getAttackRange(grid, stop, maxRange, minRange).some(({ x, y }) => x === enemy.x && y === enemy.y),
          );
          expect(inReach, `${id} on seed ${seed} from ${tile.x},${tile.y}`).toBe(true);
        }
      }
    }
  });

  it('starts the fight on turn 1 for an unlockable class: it strikes the enemy, or stops where the enemy strikes it', () => {
    for (const { id } of UNLOCKABLE_STARTING_CLASSES) {
      for (const seed of SEEDS) {
        const level = createStageLevel(seed, region, createStartingWarband(id));
        const [unitId] = level.roster;
        const unit = level.units.get(unitId)!;
        const enemy = level.units.get('enemy-1')!;
        const enemyTile = findUnit(level.grid, 'enemy-1')!;
        const strikes = (
          grid: typeof level.grid,
          from: { x: number; y: number },
          reach: typeof unit,
          mover: number,
          to: { x: number; y: number },
        ) =>
          getMovementRange(grid, from, mover).some((stop) =>
            getAttackRange(grid, stop, reach.weapon!.maxRange, reach.weapon!.minRange).some(
              ({ x, y }) => x === to.x && y === to.y,
            ),
          );
        for (const tile of level.deploymentZone.slice(0, 3)) {
          const grid = setUnit(level.grid, tile.x, tile.y, unitId);
          const contact = getMovementRange(grid, tile, unit.movement).some((stop) => {
            const moved = setUnit(setUnit(grid, tile.x, tile.y, null), stop.x, stop.y, unitId);
            return strikes(moved, stop, unit, 0, enemyTile) || strikes(moved, enemyTile, enemy, enemy.movement, stop);
          });
          expect(contact, `${id} on seed ${seed} from ${tile.x},${tile.y}`).toBe(true);
        }
      }
    }
  });

  it('is weak enough that any lone level-1 starting class wins the trade', () => {
    for (const { id } of ALL_STARTING_CLASSES) {
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
    for (const { id } of ALL_STARTING_CLASSES) {
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

describe('map archetypes on stages', () => {
  const region = REGION_CONFIGS[4];

  it('lays out every stage as an arena unless the region names a map type', () => {
    expect(region.terrain.archetype).toBeUndefined();
    expect(pickStageArchetype(region)).toBe('arena');
  });

  it('keeps a region’s own map type on every stage', () => {
    const fixed = withArchetype(region, 'islands');
    expect(fixed.terrain.archetype).toBe('islands');
    expect(fixed.terrain.width).toBe(region.terrain.width);
    expect(pickStageArchetype(fixed)).toBe('islands');
  });

  // The top-down map types were made for square 8x8 maps; the arena for the
  // side view's wide ones.
  it.each([
    ['crossroads', 8, 8],
    ['ambush', 8, 8],
    ['gauntlet', 8, 8],
    ['islands', 8, 8],
    ['fortress', 8, 8],
    ['arena', 10, 6],
    ['arena', 12, 6],
    ['arena', 8, 6],
  ] as const)(
    'builds a %s stage %ix%i that keeps every rule, deploying and placing enemies where the plan says',
    (archetype, width, height) => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const stageRegion = withArchetype({ ...region, terrain: { ...region.terrain, width, height } }, archetype);
        const layout = pickStageLayout(seed, stageRegion);
        expect(layout.problems, `${archetype} seed ${seed}`).toEqual([]);
        expect(layout.deploymentZone.slice(0, 3)).toEqual(layout.terrain.deploymentZone);
        expect(layout.deploymentZone).toHaveLength(5);
        expect(layout.enemyTiles.flat()).toHaveLength(countEnemies(region.enemies));
        const zones = new Set(layout.terrain.enemyZones!.flat().map(({ x, y }) => `${x},${y}`));
        expect(layout.enemyTiles.flat().every(({ x, y }) => zones.has(`${x},${y}`))).toBe(true);
        const level = createStageLevel(seed, stageRegion);
        expect(level.deploymentZone).toEqual(layout.deploymentZone);
        expect(level.seizeTile).toEqual(layout.terrain.seizeTile);
      }
    },
  );
});
