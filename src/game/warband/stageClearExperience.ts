// The level a won stage guarantees: clearing stage 1 brings every
// surviving unit still below level 2 up to it, on top of whatever XP its
// kills already earned, so the starting warband always takes its first
// level. Units that already reached it gain nothing more.

import { getExperienceToNextLevel } from '../experience.ts';
import { createSeededRng } from '../rng.ts';
import { UNIT_CLASSES, type UnitClass } from '../unitClasses.ts';
import { getRewardSeed, type RewardLevelUp } from './rewards.ts';
import { restoreUnit, snapshotUnit, type RunState } from './run.ts';

// The level each stage's clear guarantees, by stage.
export const STAGE_CLEAR_LEVELS: Readonly<Record<number, number>> = Object.freeze({ 1: 2 });

// Salts getRewardSeed so the level ups don't follow the reward offers' rolls.
const LEVEL_UP_SALT = 0x1e7e1;

// The level clearing `stage` guarantees, or null for none.
export function getStageClearLevel(stage: number): number | null {
  return STAGE_CLEAR_LEVELS[stage] ?? null;
}

// The run after clearing `stage` (the battle written back): every roster
// unit below the stage's guaranteed level given exactly the XP to reach it
// (unscaled, so it lands there with 0 XP), its stat gains rolled from the
// run's seed and the stage, so a stage always gives the same ones. Also
// returns each level up, in roster order, so it can be shown. The run as it
// is, with none, when the stage guarantees no level or everyone is there.
export function applyStageClearExperience(
  run: RunState,
  stage: number,
  classes: readonly UnitClass[] = UNIT_CLASSES,
): { run: RunState; levelUps: readonly RewardLevelUp[] } {
  const level = getStageClearLevel(stage);
  if (level === null || run.roster.every((unit) => unit.level >= level)) return { run, levelUps: [] };
  const rng = createSeededRng((getRewardSeed(run.seed, stage) ^ LEVEL_UP_SALT) >>> 0);
  const levelUps: RewardLevelUp[] = [];
  const roster = run.roster.map((snapshot) => {
    if (snapshot.level >= level) return snapshot;
    const unit = restoreUnit(snapshot, classes);
    while (unit.level < level) {
      const result = unit.gainExperience(getExperienceToNextLevel(unit.level, unit.experience), rng, false);
      if (result.levelUps.length === 0) break;
      levelUps.push(...result.levelUps.map((levelUp) => ({ name: unit.name, unitClass: unit.unitClass, levelUp })));
    }
    return Object.freeze(snapshotUnit(snapshot.id, unit));
  });
  return { run: Object.freeze({ ...run, roster: Object.freeze(roster) }), levelUps: Object.freeze(levelUps) };
}
