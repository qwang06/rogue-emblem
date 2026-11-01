// How strong a Warband stage's enemies are: the "surge" curve. An enemy's
// level is the stage it fights on, plus how far its group stands above the
// region's weakest (a boss group authored 2 levels up stays 2 up), plus the
// site's offset (a fort's). From SURGE_FROM_STAGE on, every enemy's stats
// are also multiplied by (1 + surge rate) a stage, uncapped, on top of its
// level ups; the rate is BASE_SURGE_RATE, raised by the run's Heat (see
// heat.ts). Pure.

import type { Unit } from '../Unit.ts';
import type { RegionConfig } from './regions.ts';

// The last stage with no surge: stage SURGE_FROM_STAGE + 1 is the first
// one multiplied.
export const SURGE_FROM_STAGE = 4;
// The percent every enemy stat grows each stage past SURGE_FROM_STAGE, at
// no Heat.
export const BASE_SURGE_RATE = 4.5;

// The lowest level any of `region`'s groups is authored at (1 when unset).
export function getRegionBaseLevel(region: RegionConfig): number {
  if (region.enemies.length === 0) return 1;
  return Math.min(...region.enemies.map((group) => group.level ?? 1));
}

// `region` with each enemy group at level `stage` + `offset` + how far it
// was authored above the region's base level, never below 1.
export function levelRegionForStage(region: RegionConfig, stage: number, offset = 0): RegionConfig {
  const base = getRegionBaseLevel(region);
  return Object.freeze({
    ...region,
    enemies: Object.freeze(
      region.enemies.map((group) =>
        Object.freeze({ ...group, level: Math.max(1, stage + offset + (group.level ?? 1) - base) }),
      ),
    ),
  });
}

// The percent enemy stats stand at on `stage` with `rate`% surge a stage:
// 100 up to SURGE_FROM_STAGE, then (1 + rate/100) compounded each stage
// past it, rounded.
export function getSurgePercent(stage: number, rate: number = BASE_SURGE_RATE): number {
  return Math.round(100 * (1 + rate / 100) ** Math.max(0, stage - SURGE_FROM_STAGE));
}

// The stats a surge multiplies (MOV and the like stay as they are).
const SURGE_STATS = [
  'maxHealth',
  'maxMana',
  'strength',
  'intelligence',
  'skill',
  'speed',
  'luck',
  'defense',
  'resistance',
] as const;

// `unit` with every SURGE_STATS stat at `percent`% (rounded, never lower),
// and its HP and mana kept as full as they were. Mutates and returns it.
export function applySurge(unit: Unit, percent: number): Unit {
  if (percent <= 100) return unit;
  const missingHealth = unit.maxHealth - unit.health;
  const missingMana = unit.maxMana - unit.mana;
  for (const stat of SURGE_STATS) unit[stat] = Math.max(unit[stat], Math.round((unit[stat] * percent) / 100));
  unit.health = Math.max(1, unit.maxHealth - missingHealth);
  unit.mana = Math.max(0, unit.maxMana - missingMana);
  return unit;
}
