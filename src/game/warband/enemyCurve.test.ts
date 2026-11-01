import { describe, expect, it } from 'vitest';
import { Soldier } from '../Soldier.ts';
import {
  applySurge,
  BASE_SURGE_RATE,
  getRegionBaseLevel,
  getSurgePercent,
  levelRegionForStage,
  SURGE_FROM_STAGE,
} from './enemyCurve.ts';
import type { RegionConfig } from './regions.ts';

const region = (levels: readonly (number | undefined)[]): RegionConfig => ({
  name: 'Test',
  terrain: { width: 8, height: 8 },
  enemies: levels.map((level) => ({ count: 1, ...(level !== undefined && { level }) })),
  treeChance: 0,
  palette: 'a-stone',
});

describe('getRegionBaseLevel', () => {
  it("is the region's lowest group level, 1 when unset or empty", () => {
    expect(getRegionBaseLevel(region([5, 7, 5]))).toBe(5);
    expect(getRegionBaseLevel(region([undefined, 3]))).toBe(1);
    expect(getRegionBaseLevel(region([]))).toBe(1);
  });
});

describe('levelRegionForStage', () => {
  it('puts the base groups at the stage, keeping a boss group its lead', () => {
    const levels = (r: RegionConfig) => r.enemies.map((group) => group.level);
    expect(levels(levelRegionForStage(region([5, 7, 5]), 20))).toEqual([20, 22, 20]);
    expect(levels(levelRegionForStage(region([undefined, 2]), 3))).toEqual([3, 4]);
  });

  it("adds the site's offset, never going below level 1", () => {
    const levels = (r: RegionConfig) => r.enemies.map((group) => group.level);
    expect(levels(levelRegionForStage(region([4]), 6, 1))).toEqual([7]);
    expect(levels(levelRegionForStage(region([4]), 1, -5))).toEqual([1]);
  });

  it('leaves the region passed in alone', () => {
    const before = region([5]);
    levelRegionForStage(before, 12);
    expect(before.enemies[0].level).toBe(5);
  });
});

describe('getSurgePercent', () => {
  it(`is 100 up to stage ${SURGE_FROM_STAGE}, then compounds ${BASE_SURGE_RATE}% a stage`, () => {
    expect(getSurgePercent(1)).toBe(100);
    expect(getSurgePercent(SURGE_FROM_STAGE)).toBe(100);
    expect(getSurgePercent(SURGE_FROM_STAGE + 1)).toBe(105);
    expect(getSurgePercent(SURGE_FROM_STAGE + 2)).toBe(109);
    expect(getSurgePercent(30)).toBe(314);
  });

  it('grows faster at a higher rate', () => {
    expect(getSurgePercent(30, 5.5)).toBe(402);
    expect(getSurgePercent(30, 6.5)).toBe(514);
  });
});

describe('applySurge', () => {
  it('multiplies every stat but MOV, keeping missing HP missing', () => {
    const unit = new Soldier({ name: 'Foe', team: 'enemy' });
    const before = { ...unit };
    unit.takeDamage(3);
    applySurge(unit, 200);
    expect(unit.maxHealth).toBe(before.maxHealth * 2);
    expect(unit.health).toBe(unit.maxHealth - 3);
    expect(unit.strength).toBe(before.strength * 2);
    expect(unit.defense).toBe(before.defense * 2);
    expect(unit.speed).toBe(before.speed * 2);
    expect(unit.movement).toBe(before.movement);
  });

  it('changes nothing at 100% or less', () => {
    const unit = new Soldier({ name: 'Foe', team: 'enemy' });
    const before = { ...unit };
    applySurge(unit, 100);
    expect({ ...unit }).toEqual(before);
  });
});
