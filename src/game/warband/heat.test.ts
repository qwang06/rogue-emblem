import { describe, expect, it } from 'vitest';
import { createBattleLevel, runStage } from '../battleSetup.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import { getRestCost, REST_COST } from './camp.ts';
import {
  applyHeatToClearGold,
  findHeatLevel,
  getHeatRules,
  getRunHeat,
  getRunHeatRules,
  HEAT_LEVELS,
  LEAN_PURSES_PERCENT,
  MAX_HEAT,
  NO_HEAT,
} from './heat.ts';
import { hasGuest, rollGuest } from './recruitment.ts';
import { getStageClearGold } from './rewards.ts';
import { advanceStage, createRun, parseRun, serializeRun, type RunState } from './run.ts';

const run = (heat?: number): RunState => {
  const base = createRun(7, new Map<string, Unit>([['alden', new Soldier({ name: 'Alden', team: 'player' })]]));
  return heat === undefined ? base : { ...base, heat };
};

describe('HEAT_LEVELS', () => {
  it('numbers its levels from 1, each with a name and a rule', () => {
    expect(HEAT_LEVELS.map(({ level }) => level)).toEqual(Array.from({ length: MAX_HEAT }, (_, i) => i + 1));
    expect(HEAT_LEVELS.every(({ name, description }) => name.length > 0 && description.length > 0)).toBe(true);
    expect(findHeatLevel(1)?.name).toBe('Hardened Foes');
    expect(findHeatLevel(0)).toBeNull();
  });
});

describe('getHeatRules', () => {
  it('changes nothing at no Heat, or below it', () => {
    expect(getHeatRules(0)).toEqual(NO_HEAT);
    expect(getHeatRules(-3)).toEqual(NO_HEAT);
  });

  it('stacks every level up to the one asked for', () => {
    expect(getHeatRules(1)).toEqual({ ...NO_HEAT, enemyLevels: 1 });
    expect(getHeatRules(2)).toEqual({ ...NO_HEAT, enemyLevels: 1, clearGoldPercent: LEAN_PURSES_PERCENT });
    expect(getHeatRules(3).restCostMultiplier).toBe(2);
    expect(getHeatRules(3).guests).toBe(true);
    expect(getHeatRules(4).guests).toBe(false);
    expect(getHeatRules(5)).toEqual({
      enemyLevels: 2,
      clearGoldPercent: LEAN_PURSES_PERCENT,
      restCostMultiplier: 2,
      guests: false,
    });
  });

  it('treats a Heat above the highest as the highest', () => {
    expect(getHeatRules(MAX_HEAT + 4)).toEqual(getHeatRules(MAX_HEAT));
  });

  it('is frozen', () => {
    expect(Object.isFrozen(getHeatRules(3))).toBe(true);
  });
});

describe("a run's Heat", () => {
  it('is none for a run without one', () => {
    expect(getRunHeat(run())).toBe(0);
    expect(getRunHeatRules(run())).toEqual(NO_HEAT);
    expect(getRunHeat(run(3))).toBe(3);
  });

  it('is saved with the run, and a bad one refuses the save', () => {
    expect(parseRun(serializeRun(run(4)))?.heat).toBe(4);
    expect(parseRun(serializeRun(run()))).not.toHaveProperty('heat');
    expect(parseRun(serializeRun(run(MAX_HEAT + 1)))).toBeNull();
    expect(parseRun(serializeRun(run(0)))).toBeNull();
  });
});

describe('Heat in the run rules', () => {
  it('cuts the clear gold from Heat 2, rounding down', () => {
    const full = getStageClearGold(3, 0).gold;
    expect(getStageClearGold(3, 0, { heat: 1 }).gold).toBe(full);
    expect(getStageClearGold(3, 0, { heat: 2 }).gold).toBe(Math.floor((full * LEAN_PURSES_PERCENT) / 100));
    expect(applyHeatToClearGold(15, 2)).toBe(11);
  });

  it('doubles the rest from Heat 3', () => {
    expect(getRestCost(run(2))).toBe(REST_COST);
    expect(getRestCost(run(3))).toBe(2 * REST_COST);
    expect(getRestCost({ ...run(3), relics: ['field-kitchen'] })).toBe(0);
  });

  it('fields no guest from Heat 4', () => {
    // Stage 2 of a linear run always fields one.
    const stage2 = (heat?: number) => advanceStage(run(heat));
    expect(hasGuest(stage2(3))).toBe(true);
    expect(hasGuest(stage2(4))).toBe(false);
    expect(rollGuest(stage2(4))).toBeNull();
  });

  it("raises the enemies' levels in battle", () => {
    const enemyLevels = (heat?: number) =>
      [...createBattleLevel(runStage(run(heat))).units.values()]
        .filter((unit) => unit.team === 'enemy')
        .map((unit) => unit.level);
    const base = enemyLevels();
    expect(enemyLevels(1)).toEqual(base.map((level) => level + 1));
    expect(enemyLevels(MAX_HEAT)).toEqual(base.map((level) => level + 2));
  });
});
