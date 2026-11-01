// The XP a won stage pays: every unit that fought it and survived earns
// clear XP that grows with the stage, more for a unit below the stage's
// level and less for one above it (catch-up), so units that miss out on
// kills don't fall too far behind. No level is guaranteed: a unit that
// fought little may not level, and one fed every kill pulls ahead, at the
// cost of its teammates. Benched units earn nothing.

import { createSeededRng } from '../rng.ts';
import { UNIT_CLASSES, type UnitClass } from '../unitClasses.ts';
import { getRewardSeed, type RewardLevelUp } from './rewards.ts';
import { restoreUnit, snapshotUnit, type RunState } from './run.ts';

// Clear XP is CLEAR_EXPERIENCE plus CLEAR_EXPERIENCE_PER_STAGE a stage.
export const CLEAR_EXPERIENCE = 20;
export const CLEAR_EXPERIENCE_PER_STAGE = 2;
// How much clear XP changes for each level a unit is below (more) or
// above (less) the stage, in percent, and the least it can fall to.
export const CATCH_UP_PERCENT = 15;
export const MIN_CLEAR_PERCENT = 20;

// Salts getRewardSeed so the level ups don't follow the reward offers' rolls.
const LEVEL_UP_SALT = 0x1e7e1;

// The clear XP a unit at `level` earns for winning `stage`, before its XP
// rate: CLEAR_EXPERIENCE + CLEAR_EXPERIENCE_PER_STAGE × stage, CATCH_UP_PERCENT
// more for each level it's below the stage and as much less for each level
// above, never under MIN_CLEAR_PERCENT of it, rounded.
export function getStageClearExperience(stage: number, level: number): number {
  const base = CLEAR_EXPERIENCE + CLEAR_EXPERIENCE_PER_STAGE * stage;
  const percent = Math.max(MIN_CLEAR_PERCENT, 100 + CATCH_UP_PERCENT * (stage - level));
  return Math.round((base * percent) / 100);
}

// The run after clearing `stage` (the battle written back): every roster
// unit in `fought` (the units that deployed and survived) given its clear
// XP (getStageClearExperience, scaled by its XP rate), its stat gains rolled
// from the run's seed and the stage, so a stage always gives the same ones.
// Also returns each level up, in roster order, so it can be shown.
export function applyStageClearExperience(
  run: RunState,
  stage: number,
  fought: readonly string[],
  classes: readonly UnitClass[] = UNIT_CLASSES,
): { run: RunState; levelUps: readonly RewardLevelUp[] } {
  if (!run.roster.some((unit) => fought.includes(unit.id))) return { run, levelUps: [] };
  const rng = createSeededRng((getRewardSeed(run.seed, stage) ^ LEVEL_UP_SALT) >>> 0);
  const levelUps: RewardLevelUp[] = [];
  const roster = run.roster.map((snapshot) => {
    if (!fought.includes(snapshot.id)) return snapshot;
    const unit = restoreUnit(snapshot, classes);
    const result = unit.gainExperience(getStageClearExperience(stage, unit.level));
    levelUps.push(...result.levelUps.map((levelUp) => ({ name: unit.name, unitClass: unit.unitClass, levelUp })));
    return Object.freeze(snapshotUnit(snapshot.id, unit));
  });
  return { run: Object.freeze({ ...run, roster: Object.freeze(roster) }), levelUps: Object.freeze(levelUps) };
}
