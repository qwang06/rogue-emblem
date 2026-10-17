// A battle's whole state as one plain value: the map, every unit in play,
// whose phase it is, how it stands, and where its dice rolls have got to.
// Commands (commands.ts) take one state to the next without touching the
// old one, so any earlier state can be kept and gone back to (history.ts).
// No Phaser, no hidden state.

import { findUnit, type Grid, type Point } from '../grid.ts';
import { DEFAULT_OBJECTIVE, type BattleSnapshot, type Objective } from '../objectives.ts';
import { getDeploymentLimit } from '../deployment.ts';
import type { Level } from '../trainingLevel.ts';
import type { BattleOutcome, TurnState } from '../turns.ts';
import type { Unit } from '../Unit.ts';
import type { ItemSnapshot } from '../warband/run.ts';

export type BattleStage = 'deployment' | 'battle';

export interface BattleState {
  readonly grid: Grid;
  // Every unit in play by unitId, both teams. A state's units are never
  // changed in place: a command that changes one puts a clone in the next
  // state's map instead.
  readonly units: ReadonlyMap<string, Unit>;
  // Player unitIds that can be deployed.
  readonly roster: readonly string[];
  readonly deploymentZone: readonly Point[];
  // How many roster units can be placed (see getDeploymentLimit).
  readonly deploymentLimit: number;
  readonly objective: Objective;
  // 'deployment' until the start-battle command, then 'battle'.
  readonly stage: BattleStage;
  // Whose phase it is, and who has moved or acted in it; null until the
  // battle starts.
  readonly turnState: TurnState | null;
  // 'victory' or 'defeat' once the objective decides the battle.
  readonly outcome: BattleOutcome | null;
  // The roster units placed when the battle started, kept after they fall.
  readonly deployed: readonly string[];
  // Units taken off the map at 0 health, as they fell, by unitId.
  readonly fallen: ReadonlyMap<string, Unit>;
  // Items sent to the convoy: loot a full-handed unit couldn't carry, and
  // tomes handed back by a spell learned from them.
  readonly convoyLoot: readonly ItemSnapshot[];
  // The seed the battle's next roll comes from (see createResumableRng).
  readonly rngState: number;
}

// The state a level starts in, before any unit is placed, with its rolls
// seeded by `seed`. The state takes the level's units over: don't change
// them afterwards.
export function createBattleState(
  level: Pick<Level, 'grid' | 'units' | 'roster' | 'deploymentZone' | 'maxDeployed' | 'objective'>,
  seed: number,
): BattleState {
  return Object.freeze({
    grid: level.grid,
    units: new Map(level.units),
    roster: Object.freeze([...level.roster]),
    deploymentZone: Object.freeze([...level.deploymentZone]),
    deploymentLimit: getDeploymentLimit(level.roster, level.deploymentZone, level.maxDeployed),
    objective: level.objective ?? DEFAULT_OBJECTIVE,
    stage: 'deployment',
    turnState: null,
    outcome: null,
    deployed: Object.freeze([]),
    fallen: new Map(),
    convoyLoot: Object.freeze([]),
    rngState: seed >>> 0,
  });
}

// The roster units that fought, by unitId, as they stand now (fallen ones
// as they fell): what a Warband run writes back (see finishStage).
export function getDeployedUnits(state: BattleState): Map<string, Unit> {
  const deployed = new Map<string, Unit>();
  for (const unitId of state.deployed) {
    const unit = state.units.get(unitId) ?? state.fallen.get(unitId);
    if (unit) deployed.set(unitId, unit);
  }
  return deployed;
}

// What the objective is checked against: every unit still in play, where
// it stands, and the turn.
export function getBattleSnapshot(state: BattleState): BattleSnapshot {
  return {
    turn: state.turnState?.turn ?? 1,
    units: [...state.units].map(([unitId, unit]) => ({
      unitId,
      team: unit.team,
      alive: unit.isAlive(),
      position: findUnit(state.grid, unitId),
    })),
  };
}
