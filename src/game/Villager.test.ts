import { describe, expect, it } from 'vitest';
import { ARCHER_CAPS, ARCHER_GROWTHS } from './Archer.ts';
import { DEFAULT_EXPERIENCE_RATE, GROWTH_STATS } from './experience.ts';
import { STARTING_ITEMS } from './items.ts';
import { THROW_STONES, getLearnedSkills } from './skills.ts';
import { Unit } from './Unit.ts';
import { SOLDIER_CAPS, SOLDIER_GROWTHS, SOLDIER_STATS } from './Soldier.ts';
import {
  VILLAGER_CAPS,
  VILLAGER_EXPERIENCE_RATE,
  VILLAGER_GROWTHS,
  VILLAGER_ITEMS,
  VILLAGER_STATS,
  Villager,
} from './Villager.ts';
import { FISTS } from './weapons.ts';

describe('Villager', () => {
  it('is a Unit of the villager class', () => {
    const villager = new Villager({ team: 'player' });
    expect(villager).toBeInstanceOf(Unit);
    expect(villager.unitClass).toBe('villager');
    expect(villager.name).toBe('Villager');
    expect(villager.team).toBe('player');
    expect(villager.level).toBe(1);
  });

  it('uses the villager stat line, growths and caps', () => {
    const villager = new Villager({ team: 'player' });
    expect(villager.maxHealth).toBe(VILLAGER_STATS.health);
    expect(villager.maxMana).toBe(VILLAGER_STATS.mana);
    expect(villager.strength).toBe(VILLAGER_STATS.strength);
    expect(villager.speed).toBe(VILLAGER_STATS.speed);
    expect(villager.movement).toBe(VILLAGER_STATS.movement);
    expect(villager.growths).toBe(VILLAGER_GROWTHS);
    expect(villager.caps).toBe(VILLAGER_CAPS);
  });

  it('accepts a custom name and level', () => {
    const villager = new Villager({ name: 'Alden', team: 'player', level: 3 });
    expect(villager.name).toBe('Alden');
    expect(villager.level).toBe(3);
  });

  it('carries its fists and the starting potions by default', () => {
    const villager = new Villager({ team: 'player' });
    expect(villager.items).toEqual(VILLAGER_ITEMS);
    expect(villager.items.slice(1)).toEqual(STARTING_ITEMS);
  });

  it('fights with fists that never break', () => {
    const villager = new Villager({ team: 'player' });
    expect(villager.weaponTypes).toEqual(['physical']);
    expect(villager.weapon).toBe(FISTS);
    expect(villager.weaponUses).toBeNull();
    for (let i = 0; i < 100; i++) expect(villager.spendWeaponUse().broke).toBe(false);
    expect(villager.weapon).toBe(FISTS);
  });

  it('knows Throw Stones from level 1', () => {
    expect(getLearnedSkills('villager', 1)).toEqual([THROW_STONES]);
  });

  it('starts no stronger than a soldier', () => {
    expect(VILLAGER_STATS).toEqual(SOLDIER_STATS);
  });

  it('out-grows the soldier and the archer: every growth and cap at least theirs, and more in total', () => {
    const total = (table: Record<string, number>) => Object.values(table).reduce((sum, value) => sum + value, 0);
    for (const [growths, caps] of [
      [SOLDIER_GROWTHS, SOLDIER_CAPS],
      [ARCHER_GROWTHS, ARCHER_CAPS],
    ]) {
      for (const stat of GROWTH_STATS) {
        expect(VILLAGER_GROWTHS[stat]).toBeGreaterThanOrEqual(growths[stat]);
        expect(VILLAGER_CAPS[stat]).toBeGreaterThanOrEqual(caps[stat]);
      }
      expect(total(VILLAGER_GROWTHS)).toBeGreaterThan(total(growths));
      expect(total(VILLAGER_CAPS)).toBeGreaterThan(total(caps));
    }
  });

  it('earns XP half again as fast as other classes', () => {
    expect(VILLAGER_EXPERIENCE_RATE).toBe(150);
    const villager = new Villager({ team: 'player' });
    expect(villager.experienceRate).toBe(VILLAGER_EXPERIENCE_RATE);
    expect(villager.gainExperience(20, () => 0)).toMatchObject({ amount: 30, level: 1, experience: 30 });
    expect(
      new Unit({ name: 'Plain', health: 10, strength: 1, defense: 0, movement: 5, team: 'player' }).experienceRate,
    ).toBe(DEFAULT_EXPERIENCE_RATE);
  });

  it('reaches a level a soldier would still be working toward', () => {
    const villager = new Villager({ team: 'player' });
    villager.gainExperience(70, () => 0);
    expect(villager.level).toBe(2);
    expect(villager.experience).toBe(5);
  });
});
