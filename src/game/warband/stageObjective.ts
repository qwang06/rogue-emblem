// A Warband Mode stage's objective (objectives.ts): which kind the stage
// plays, and placing it on the stage's generated map. A region can fix the
// kind for all its stages; otherwise the first stage is a rout and every
// later one draws a kind from its seed, so a run mixes them and a seed
// still rebuilds the same battle.

import { getWalkingDistances } from '../enemySpawns.ts';
import { findUnit, getCell, type Grid, type Point } from '../grid.ts';
import { getMoveCost } from '../movement.ts';
import {
  OBJECTIVE_KINDS,
  ROUT,
  SURVIVE_TURNS,
  type Objective,
  type ObjectiveKind,
  type ObjectiveSpec,
} from '../objectives.ts';
import { createSeededRng, randomItem } from '../rng.ts';
import { UNIT_CLASSES } from '../unitClasses.ts';
import type { Unit } from '../Unit.ts';
import type { BuildingKind, BuildingPlacement } from '../buildings.ts';
import type { RegionConfig } from './regions.ts';

// Mixed into the stage seed so the objective's draw doesn't follow the
// map's own first rolls.
const OBJECTIVE_SEED_SALT = 0x0b1ec7;

// The buildings a seize objective prefers to put its tile on.
const SEIZE_BUILDINGS: readonly BuildingKind[] = Object.freeze(['castle', 'fort']);

// Levels a boss gains over its class's level-1 stats, and what each adds.
export const BOSS_LEVELS = 2;
const BOSS_LEVEL_GAINS = Object.freeze({ health: 2, strength: 1, defense: 1 });

// The objective kind stage `stage` (1 is the first) of `region` plays,
// seeded by the stage's `seed`: the region's own if it sets one, a rout on
// stage 1, else any kind from OBJECTIVE_KINDS.
export function pickStageObjective(stage: number, region: RegionConfig, seed: number): ObjectiveSpec {
  if (region.objective) return region.objective;
  if (stage <= 1) return ROUT;
  const kind: ObjectiveKind = randomItem(createSeededRng(seed ^ OBJECTIVE_SEED_SALT), OBJECTIVE_KINDS);
  return { kind };
}

// What placing an objective reads off a level.
export interface ObjectiveLevel {
  grid: Grid;
  units: ReadonlyMap<string, Unit>;
  deploymentZone: readonly Point[];
  buildings?: readonly BuildingPlacement[];
  seizeTile?: Point;
  bossUnitId?: string;
}

const key = ({ x, y }: Point) => `${x},${y}`;

const isWalkable = (grid: Grid, p: Point) => Number.isFinite(getMoveCost(getCell(grid, p.x, p.y)?.terrain ?? null));

// `spec` placed on `level`, as the Objective the battle checks:
// - seize: the level's seizeTile if the deployment zone can walk to it,
//   else a castle or fort it can walk to, else the walkable tile farthest
//   from the zone (northmost, then westmost, on a tie)
// - boss: the level's named boss (bossUnitId) while it's on the map, as
//   it is; else the enemy farthest from the zone (first in the registry
//   on a tie), made into the boss (makeBoss)
// - survive: SURVIVE_TURNS unless the spec says
// Falls back to a rout when there's nowhere to seize or no enemy to make the
// boss. Note a boss is changed in place in level.units.
export function placeObjective(spec: ObjectiveSpec, level: ObjectiveLevel): Objective {
  const distances = getWalkingDistances(level.grid, level.deploymentZone);
  const fromZone = (p: Point) => distances.get(key(p)) ?? -1;
  switch (spec.kind) {
    case 'rout':
      return ROUT;
    case 'survive':
      return Object.freeze({ kind: 'survive', turns: spec.turns ?? SURVIVE_TURNS });
    case 'seize': {
      const tile = pickSeizeTile(level, fromZone);
      return tile ? Object.freeze({ kind: 'seize', tile: Object.freeze(tile) }) : ROUT;
    }
    case 'boss': {
      const named = level.bossUnitId ? level.units.get(level.bossUnitId) : undefined;
      if (named && level.bossUnitId && findUnit(level.grid, level.bossUnitId)) {
        named.rank = 'boss';
        return Object.freeze({ kind: 'boss', unitId: level.bossUnitId, name: named.name });
      }
      let best: { unitId: string; distance: number } | null = null;
      for (const [unitId, unit] of level.units) {
        const at = unit.team === 'enemy' ? findUnit(level.grid, unitId) : null;
        if (!at) continue;
        const distance = fromZone(at);
        if (!best || distance > best.distance) best = { unitId, distance };
      }
      if (!best) return ROUT;
      const boss = level.units.get(best.unitId)!;
      makeBoss(boss);
      return Object.freeze({ kind: 'boss', unitId: best.unitId, name: boss.name });
    }
  }
}

function pickSeizeTile(level: ObjectiveLevel, fromZone: (p: Point) => number): Point | null {
  if (level.seizeTile && fromZone(level.seizeTile) > 0) return { ...level.seizeTile };
  const building = (level.buildings ?? []).find(
    (b) => SEIZE_BUILDINGS.includes(b.building) && isWalkable(level.grid, b) && fromZone(b) > 0,
  );
  if (building) return { x: building.x, y: building.y };
  // Cells run north to south, west to east, so the first farthest wins ties.
  let best: { tile: Point; distance: number } | null = null;
  for (const { x, y } of level.grid.cells) {
    const distance = fromZone({ x, y });
    if (distance > (best?.distance ?? 0)) best = { tile: { x, y }, distance };
  }
  return best?.tile ?? null;
}

// Turns `unit` into a boss: named "<Class> Chief", BOSS_LEVELS levels up
// (BOSS_LEVEL_GAINS each), holding its ground (it strikes whoever comes in
// reach but never moves) and ranked 'boss'.
export function makeBoss(unit: Unit): void {
  const label = UNIT_CLASSES.find((c) => c.id === unit.unitClass)?.label ?? unit.unitClass ?? 'Enemy';
  unit.name = `${label} Chief`;
  for (let i = 0; i < BOSS_LEVELS; i++) unit.levelUp(BOSS_LEVEL_GAINS);
  unit.holdsPosition = true;
  unit.rank = 'boss';
}
