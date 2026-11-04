import { describe, expect, it } from 'vitest';
import { ARCHER_GROWTHS } from './Archer.ts';
import { DEFAULT_EXPERIENCE_RATE, GROWTH_STATS } from './experience.ts';
import { STARTING_ITEMS } from './items.ts';
import { THROW_STONES, getLearnedSkills } from './skills.ts';
import { Unit } from './Unit.ts';
import { SOLDIER_GROWTHS, SOLDIER_STATS } from './Soldier.ts';
import { VILLAGER_EXPERIENCE_RATE, VILLAGER_GROWTHS, VILLAGER_ITEMS, VILLAGER_STATS, Villager } from './Villager.ts';
import { FISTS, WOODEN_SWORD } from './weapons.ts';

describe('Villager', () => {
  it('is a Unit of the villager class', () => {
    const villager = new Villager({ team: 'player' });
    expect(villager).toBeInstanceOf(Unit);
    expect(villager.unitClass).toBe('villager');
    expect(villager.name).toBe('Villager');
    expect(villager.team).toBe('player');
    expect(villager.level).toBe(1);
  });

  it('uses the villager stat line and growths', () => {
    const villager = new Villager({ team: 'player' });
    expect(villager.maxHealth).toBe(VILLAGER_STATS.health);
    expect(villager.maxMana).toBe(VILLAGER_STATS.mana);
    expect(villager.strength).toBe(VILLAGER_STATS.strength);
    expect(villager.speed).toBe(VILLAGER_STATS.speed);
    expect(villager.movement).toBe(VILLAGER_STATS.movement);
    expect(villager.growths).toBe(VILLAGER_GROWTHS);
  });

  it('accepts a custom name and level', () => {
    const villager = new Villager({ name: 'Alden', team: 'player', level: 3 });
    expect(villager.name).toBe('Alden');
    expect(villager.level).toBe(3);
  });

  it('holds a wooden sword, has its fists and carries the starting potions by default', () => {
    const villager = new Villager({ team: 'player' });
    expect(VILLAGER_ITEMS.slice(2)).toEqual(STARTING_ITEMS);
    expect(villager.equipment).toEqual({ main: WOODEN_SWORD });
    expect(villager.innate).toEqual([FISTS]);
    expect(villager.items).toEqual(STARTING_ITEMS);
  });

  it('fights with its wooden sword, or its fists', () => {
    const villager = new Villager({ team: 'player' });
    expect(villager.weaponTypes).toEqual(['sword']);
    expect(villager.weapon).toBe(WOODEN_SWORD);
    expect(villager.wieldableWeapons.map(({ weapon }) => weapon)).toEqual([WOODEN_SWORD, FISTS]);
  });

  it('learns Throw Stones at level 2', () => {
    expect(getLearnedSkills('villager', 1)).toEqual([]);
    expect(getLearnedSkills('villager', 2)).toEqual([THROW_STONES]);
  });

  it('starts a point of strength below a soldier and otherwise level with one', () => {
    expect(VILLAGER_STATS).toEqual({ ...SOLDIER_STATS, strength: SOLDIER_STATS.strength - 1 });
  });

  it('out-grows the soldier and the archer in total', () => {
    const total = (table: Record<string, number>) => Object.values(table).reduce((sum, value) => sum + value, 0);
    for (const growths of [SOLDIER_GROWTHS, ARCHER_GROWTHS]) {
      expect(total(VILLAGER_GROWTHS)).toBeGreaterThan(total(growths));
    }
  });

  it('earns XP half again as fast as other classes', () => {
    expect(VILLAGER_EXPERIENCE_RATE).toBe(150);
    const villager = new Villager({ team: 'player' });
    expect(villager.experienceRate).toBe(VILLAGER_EXPERIENCE_RATE);
    expect(villager.gainExperience(20)).toMatchObject({ amount: 30, level: 1, experience: 30 });
    expect(
      new Unit({ name: 'Plain', health: 10, strength: 1, defense: 0, movement: 5, team: 'player' }).experienceRate,
    ).toBe(DEFAULT_EXPERIENCE_RATE);
  });

  it('reaches a level a soldier would still be working toward', () => {
    const villager = new Villager({ team: 'player' });
    villager.gainExperience(40);
    expect(villager.level).toBe(2);
    expect(villager.experience).toBe(10);
  });
});
