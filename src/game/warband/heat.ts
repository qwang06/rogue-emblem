// Warband Mode's Heat levels: Slay the Spire's Ascension. Winning a run
// opens Heat 1, and winning at the highest Heat open opens the next (see
// meta.ts). A new run picks any open level, and each level adds its rule
// on top of every lower level's, so Heat 3 plays with the rules of 1, 2
// and 3. The rules that read the Heat (battleSetup.ts for enemy levels,
// rewards.ts for clear gold, camp.ts for the rest and recruitment.ts for
// guests) ask getHeatRules for them. Pure data and lookups.

import type { RunState } from './run.ts';

// What a run's Heat changes, all levels together.
export interface HeatRules {
  // Levels every enemy gains.
  enemyLevels: number;
  // The share of a stage clear's gold paid, in percent.
  clearGoldPercent: number;
  // What a rest's cost is multiplied by.
  restCostMultiplier: number;
  // Whether guests fight alongside the warband (and offer to join).
  guests: boolean;
}

export interface HeatLevel {
  // From 1.
  level: number;
  name: string;
  description: string;
  // The rules with this level's added.
  apply: (rules: HeatRules) => HeatRules;
}

// The rules of a run with no Heat.
export const NO_HEAT: HeatRules = Object.freeze({
  enemyLevels: 0,
  clearGoldPercent: 100,
  restCostMultiplier: 1,
  guests: true,
});

// The share of a clear's gold Lean Purses pays, in percent.
export const LEAN_PURSES_PERCENT = 75;

function heatLevel(level: number, name: string, description: string, apply: HeatLevel['apply']): HeatLevel {
  return Object.freeze({ level, name, description, apply });
}

// Every Heat level, from 1.
export const HEAT_LEVELS: readonly HeatLevel[] = Object.freeze([
  heatLevel(1, 'Hardened Foes', 'Enemies are 1 level higher.', (rules) => ({
    ...rules,
    enemyLevels: rules.enemyLevels + 1,
  })),
  heatLevel(2, 'Lean Purses', `Stage clears pay ${100 - LEAN_PURSES_PERCENT}% less gold.`, (rules) => ({
    ...rules,
    clearGoldPercent: LEAN_PURSES_PERCENT,
  })),
  heatLevel(3, 'Costly Rest', 'Resting at camp costs double.', (rules) => ({ ...rules, restCostMultiplier: 2 })),
  heatLevel(4, 'Closed Ranks', 'No guests fight alongside the warband, so none join it.', (rules) => ({
    ...rules,
    guests: false,
  })),
  heatLevel(5, "Warlord's Wrath", 'Enemies are 1 more level higher.', (rules) => ({
    ...rules,
    enemyLevels: rules.enemyLevels + 1,
  })),
]);

// The highest Heat level.
export const MAX_HEAT = HEAT_LEVELS.length;

// The Heat `run` is played at: 0 when it has none.
export function getRunHeat(run: Pick<RunState, 'heat'>): number {
  return run.heat ?? 0;
}

// The rules of Heat `heat`: every level up to it applied in order. Heat
// below 1 is no Heat, and above MAX_HEAT is MAX_HEAT.
export function getHeatRules(heat: number): HeatRules {
  return Object.freeze(HEAT_LEVELS.filter(({ level }) => level <= heat).reduce((rules, l) => l.apply(rules), NO_HEAT));
}

// The rules `run` plays by.
export function getRunHeatRules(run: Pick<RunState, 'heat'>): HeatRules {
  return getHeatRules(getRunHeat(run));
}

// The Heat level `level`, or null.
export function findHeatLevel(level: number): HeatLevel | null {
  return HEAT_LEVELS.find((candidate) => candidate.level === level) ?? null;
}

// `gold` from a stage clear as Heat `heat` pays it, rounded down.
export function applyHeatToClearGold(gold: number, heat: number): number {
  return Math.floor((gold * getHeatRules(heat).clearGoldPercent) / 100);
}
