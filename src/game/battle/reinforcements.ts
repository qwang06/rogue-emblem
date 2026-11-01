// Enemies that join a battle after it starts, and how strong they come:
// the stage's reinforcement rules. Every arrival (a boss's horn call, see
// bosses.ts, or a wave) comes at least at the stage's enemy level and with
// its stat surge (warband/enemyCurve.ts), so late arrivals keep up with
// the enemies that started on the map. A battle with `waves` also has one
// enemy (of its region's classes, in turn) arrive on every `every`th enemy
// phase, on the free tile farthest from the deployment zone, up to `limit`
// a battle. Pure: the battle (battle/commands.ts) keeps a
// ReinforcementState and applies them.

import type { Grid, Point } from '../grid.ts';
import { getCell } from '../grid.ts';
import { getMoveCost } from '../movement.ts';
import { createUnitOfClass } from '../unitClasses.ts';
import { UNIT_CLASSES } from '../unitClasses.ts';
import type { Unit } from '../Unit.ts';
import { growToLevel } from '../experience.ts';
import { applySurge } from '../warband/enemyCurve.ts';

export interface WaveRules {
  // An enemy arrives on every `every`th enemy phase (turn every, 2 × every, ...).
  every: number;
  // The classes that arrive, in turn.
  classes: readonly string[];
  // The most that arrive in one battle.
  limit: number;
}

export interface ReinforcementRules {
  // The level and the stat surge (percent) every arrival comes with, at
  // least.
  level: number;
  surgePercent: number;
  waves?: WaveRules;
}

export interface ReinforcementState {
  rules: ReinforcementRules;
  // How many waves have arrived.
  arrived: number;
}

// The first stage whose battles bring waves, how often and how many.
export const WAVES_FROM_STAGE = 10;
export const WAVE_EVERY = 2;
export const WAVE_LIMIT = 6;

// A fresh state for `rules`, or null without them.
export function createReinforcementState(rules: ReinforcementRules | undefined): ReinforcementState | null {
  return rules ? Object.freeze({ rules, arrived: 0 }) : null;
}

// Whether a wave arrives on the enemy phase of `turn`.
export function isWaveTurn(state: ReinforcementState, turn: number): boolean {
  const waves = state.rules.waves;
  return !!waves && waves.classes.length > 0 && state.arrived < waves.limit && turn % waves.every === 0;
}

// The unit id of the `n`th wave arrival (from 1).
export function getWaveUnitId(n: number): string {
  return `wave-${n}`;
}

// An enemy of `classId` at `level` (or `rules`' level when higher), with
// `rules`' surge.
export function createArrival(classId: string, level: number, rules: ReinforcementRules | null): Unit {
  const label = UNIT_CLASSES.find((c) => c.id === classId)?.label ?? classId;
  const unit = createUnitOfClass(classId, { name: `Enemy ${label}`, team: 'enemy' });
  growToLevel(unit, Math.max(level, rules?.level ?? 1));
  if (rules) applySurge(unit, rules.surgePercent);
  return unit;
}

// The next wave's arrival: the class whose turn it is.
export function createWaveArrival(state: ReinforcementState): Unit {
  const classes = state.rules.waves?.classes ?? [];
  return createArrival(classes[state.arrived % classes.length], state.rules.level, state.rules);
}

// The free, walkable tile farthest from `zone` (by steps to its nearest
// tile), the one nearest the map's middle column on a tie, then the
// topmost; null when there's none.
export function pickWaveTile(grid: Grid, zone: readonly Point[]): Point | null {
  if (zone.length === 0) return null;
  const middle = (grid.width - 1) / 2;
  let best: { point: Point; distance: number } | null = null;
  for (const cell of grid.cells) {
    if (cell.unitId || getMoveCost(cell.terrain) === Infinity) continue;
    const distance = Math.min(...zone.map(({ x, y }) => Math.abs(cell.x - x) + Math.abs(cell.y - y)));
    const better =
      !best ||
      distance > best.distance ||
      (distance === best.distance &&
        (Math.abs(cell.x - middle) < Math.abs(best.point.x - middle) ||
          (Math.abs(cell.x - middle) === Math.abs(best.point.x - middle) && cell.y < best.point.y)));
    if (better) best = { point: { x: cell.x, y: cell.y }, distance };
  }
  return best && getCell(grid, best.point.x, best.point.y) ? best.point : null;
}
