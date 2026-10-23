import { describe, expect, it } from 'vitest';
import { REGION_CONFIGS } from '../../data/regions.ts';
import { getWalkingDistances } from '../enemySpawns.ts';
import { findUnit, getCell, setUnit } from '../grid.ts';
import { OBJECTIVE_KINDS, ROUT, SURVIVE_TURNS, type Objective } from '../objectives.ts';
import { parseTerrainMap } from '../terrainMap.ts';
import { createUnitOfClass } from '../unitClasses.ts';
import type { Unit } from '../Unit.ts';
import { BOSS_LEVELS, makeBoss, pickStageObjective, placeObjective, type ObjectiveLevel } from './stageObjective.ts';
import { createStageLevel } from './stageLevel.ts';

const [FIRST] = REGION_CONFIGS;
const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 11);

describe('pickStageObjective', () => {
  it('makes the first stage a rout', () => {
    for (const seed of SEEDS) expect(pickStageObjective(1, FIRST, seed)).toBe(ROUT);
  });

  it('draws every kind on later stages, the same for the same seed', () => {
    const kinds = new Set(SEEDS.map((seed) => pickStageObjective(2, FIRST, seed).kind));
    expect([...kinds].sort()).toEqual([...OBJECTIVE_KINDS].sort());
    for (const seed of SEEDS.slice(0, 20)) {
      expect(pickStageObjective(5, FIRST, seed)).toEqual(pickStageObjective(5, FIRST, seed));
    }
  });

  it('uses the region’s own objective on every stage', () => {
    const region = { ...FIRST, objective: { kind: 'survive', turns: 6 } as const };
    for (const stage of [1, 2, 9]) expect(pickStageObjective(stage, region, 3)).toBe(region.objective);
  });
});

// A small hand-made level: the player deploys on the south row, a wall of
// water splits the map but for a gap, and two enemies wait to the north.
function smallLevel(rows: readonly string[]): ObjectiveLevel & { units: Map<string, Unit> } {
  let grid = parseTerrainMap(rows);
  const units = new Map<string, Unit>();
  const near = createUnitOfClass('goblin', { name: 'Enemy Goblin', team: 'enemy' });
  const far = createUnitOfClass('skeleton', { name: 'Enemy Skeleton', team: 'enemy' });
  units.set('enemy-1', near).set('enemy-2', far);
  grid = setUnit(setUnit(grid, 1, 2, 'enemy-1'), 3, 0, 'enemy-2');
  return { grid, units, deploymentZone: [{ x: 0, y: 4 }] };
}

const MAP = ['....', '....', '....', '~~.~', '....'];

describe('placeObjective', () => {
  it('places a rout and a survive as they are, survive defaulting its turns', () => {
    const level = smallLevel(MAP);
    expect(placeObjective({ kind: 'rout' }, level)).toBe(ROUT);
    expect(placeObjective({ kind: 'survive' }, level)).toEqual({ kind: 'survive', turns: SURVIVE_TURNS });
    expect(placeObjective({ kind: 'survive', turns: 2 }, level)).toEqual({ kind: 'survive', turns: 2 });
  });

  it('seizes the walkable tile farthest from deployment, northmost then westmost on a tie', () => {
    const objective = placeObjective({ kind: 'seize' }, smallLevel(MAP));
    // Through the gap at (2, 3), (0, 0) is 8 steps away and so is nothing else.
    expect(objective).toEqual({ kind: 'seize', tile: { x: 0, y: 0 } });
  });

  it('seizes the tile the map was planned around, when the deployment can walk to it', () => {
    const level = {
      ...smallLevel(MAP),
      buildings: [{ x: 3, y: 1, building: 'fort' as const }],
      seizeTile: { x: 1, y: 1 },
    };
    expect(placeObjective({ kind: 'seize' }, level)).toEqual({ kind: 'seize', tile: { x: 1, y: 1 } });
    const cutOff = { ...smallLevel(['...~', '...~', '..~.', '~~.~', '....']), seizeTile: { x: 3, y: 2 } };
    expect(placeObjective({ kind: 'seize' }, cutOff)).not.toEqual({ kind: 'seize', tile: { x: 3, y: 2 } });
  });

  it('seizes a castle or fort the deployment can walk to', () => {
    const level = { ...smallLevel(MAP), buildings: [{ x: 3, y: 1, building: 'fort' as const }] };
    expect(placeObjective({ kind: 'seize' }, level)).toEqual({ kind: 'seize', tile: { x: 3, y: 1 } });
    const cutOff = {
      ...smallLevel(['...~', '...~', '..~.', '~~.~', '....']),
      buildings: [{ x: 3, y: 2, building: 'castle' as const }],
    };
    expect(placeObjective({ kind: 'seize' }, cutOff)).not.toEqual({ kind: 'seize', tile: { x: 3, y: 2 } });
  });

  it('falls back to a rout when there is nowhere to seize', () => {
    const level = smallLevel(['~~~~', '~~~~', '~~~~', '~~~~', '.~~~']);
    expect(placeObjective({ kind: 'seize' }, { ...level, units: new Map() })).toBe(ROUT);
  });

  it('makes the enemy farthest from deployment the boss', () => {
    const level = smallLevel(MAP);
    const objective = placeObjective({ kind: 'boss' }, level);
    expect(objective).toEqual({ kind: 'boss', unitId: 'enemy-2', name: 'Skeleton Chief' });
    expect(level.units.get('enemy-2')!.holdsPosition).toBe(true);
    expect(level.units.get('enemy-1')!.holdsPosition).toBe(false);
  });

  it('targets the level’s named boss as it is, while it’s on the map', () => {
    const level = smallLevel(MAP);
    level.units.get('enemy-1')!.name = 'Orc Warlord';
    const objective = placeObjective({ kind: 'boss' }, { ...level, bossUnitId: 'enemy-1' });
    expect(objective).toEqual({ kind: 'boss', unitId: 'enemy-1', name: 'Orc Warlord' });
    expect(level.units.get('enemy-1')!.level).toBe(1);
    expect(placeObjective({ kind: 'boss' }, { ...smallLevel(MAP), bossUnitId: 'enemy-9' })).toMatchObject({
      unitId: 'enemy-2',
    });
  });

  it('falls back to a rout when there is no enemy to make the boss', () => {
    expect(placeObjective({ kind: 'boss' }, { ...smallLevel(MAP), units: new Map() })).toBe(ROUT);
  });
});

describe('makeBoss', () => {
  it('names, levels and plants the unit', () => {
    const unit = createUnitOfClass('goblin', { name: 'Enemy Goblin', team: 'enemy' });
    const before = { level: unit.level, maxHealth: unit.maxHealth, strength: unit.strength, defense: unit.defense };
    makeBoss(unit);
    expect(unit.name).toBe('Goblin Chief');
    expect(unit.level).toBe(before.level + BOSS_LEVELS);
    expect(unit.maxHealth).toBe(before.maxHealth + 2 * BOSS_LEVELS);
    expect(unit.health).toBe(unit.maxHealth);
    expect(unit.strength).toBe(before.strength + BOSS_LEVELS);
    expect(unit.defense).toBe(before.defense + BOSS_LEVELS);
    expect(unit.holdsPosition).toBe(true);
  });
});

describe('objectives on generated stages', () => {
  const placed = (kind: 'seize' | 'boss') =>
    REGION_CONFIGS.flatMap((region) =>
      SEEDS.slice(0, 40).map((seed) => {
        const level = createStageLevel(seed, region);
        return { level, objective: placeObjective({ kind }, level) as Objective };
      }),
    );

  it('always finds a seize tile the warband can walk to, off the deployment zone', () => {
    for (const { level, objective } of placed('seize')) {
      expect(objective.kind).toBe('seize');
      if (objective.kind !== 'seize') continue;
      const distances = getWalkingDistances(level.grid, level.deploymentZone);
      expect(distances.get(`${objective.tile.x},${objective.tile.y}`)).toBeGreaterThan(0);
      expect(getCell(level.grid, objective.tile.x, objective.tile.y)).toBeDefined();
    }
  });

  it('always makes one of the stage’s enemies the boss', () => {
    for (const { level, objective } of placed('boss')) {
      expect(objective.kind).toBe('boss');
      if (objective.kind !== 'boss') continue;
      const boss = level.units.get(objective.unitId)!;
      expect(boss.team).toBe('enemy');
      expect(findUnit(level.grid, objective.unitId)).not.toBeNull();
      expect(boss.name).toMatch(/ Chief$/);
    }
  });
});
