import { describe, expect, it } from 'vitest';
import { ARCHER_CAPS, ARCHER_GROWTHS } from './Archer.ts';
import { DEFAULT_EXPERIENCE_RATE, GROWTH_STATS } from './experience.ts';
import { STARTING_ITEMS } from './items.ts';
import { THROW_STONES, getLearnedSkills } from './skills.ts';
import { Unit } from './Unit.ts';
import { SOLDIER_CAPS, SOLDIER_GROWTHS, SOLDIER_STATS } from './Soldier.ts';
import {
  WARRIOR_CAPS,
  WARRIOR_EXPERIENCE_RATE,
  WARRIOR_GROWTHS,
  WARRIOR_ITEMS,
  WARRIOR_STATS,
  Warrior,
} from './Warrior.ts';
import { FISTS, WOODEN_SWORD } from './weapons.ts';

describe('Warrior', () => {
  it('is a Unit of the warrior class', () => {
    const warrior = new Warrior({ team: 'player' });
    expect(warrior).toBeInstanceOf(Unit);
    expect(warrior.unitClass).toBe('warrior');
    expect(warrior.name).toBe('Warrior');
    expect(warrior.team).toBe('player');
    expect(warrior.level).toBe(1);
  });

  it('uses the warrior stat line, growths and caps', () => {
    const warrior = new Warrior({ team: 'player' });
    expect(warrior.maxHealth).toBe(WARRIOR_STATS.health);
    expect(warrior.maxMana).toBe(WARRIOR_STATS.mana);
    expect(warrior.strength).toBe(WARRIOR_STATS.strength);
    expect(warrior.speed).toBe(WARRIOR_STATS.speed);
    expect(warrior.movement).toBe(WARRIOR_STATS.movement);
    expect(warrior.growths).toBe(WARRIOR_GROWTHS);
    expect(warrior.caps).toBe(WARRIOR_CAPS);
  });

  it('accepts a custom name and level', () => {
    const warrior = new Warrior({ name: 'Alden', team: 'player', level: 3 });
    expect(warrior.name).toBe('Alden');
    expect(warrior.level).toBe(3);
  });

  it('carries a wooden sword, its fists and the starting potions by default', () => {
    const warrior = new Warrior({ team: 'player' });
    expect(warrior.items).toEqual(WARRIOR_ITEMS);
    expect(warrior.items.slice(2)).toEqual(STARTING_ITEMS);
  });

  it('fights with its wooden sword, then its fists once the sword breaks', () => {
    const warrior = new Warrior({ team: 'player' });
    expect(warrior.weaponTypes).toEqual(['physical']);
    expect(warrior.weapon).toBe(WOODEN_SWORD);
    expect(warrior.weaponUses).toBe(WOODEN_SWORD.uses);
    for (let i = 1; i < (WOODEN_SWORD.uses ?? 0); i++) expect(warrior.spendWeaponUse().broke).toBe(false);
    expect(warrior.spendWeaponUse().broke).toBe(true);
    expect(warrior.weapon).toBe(FISTS);
    for (let i = 0; i < 100; i++) expect(warrior.spendWeaponUse().broke).toBe(false);
    expect(warrior.weapon).toBe(FISTS);
  });

  it('learns Throw Stones at level 2', () => {
    expect(getLearnedSkills('warrior', 1)).toEqual([]);
    expect(getLearnedSkills('warrior', 2)).toEqual([THROW_STONES]);
  });

  it('starts a point of strength below a soldier and otherwise level with one', () => {
    expect(WARRIOR_STATS).toEqual({ ...SOLDIER_STATS, strength: SOLDIER_STATS.strength - 1 });
  });

  it('out-grows the soldier and the archer: every growth and cap at least theirs, and more in total', () => {
    const total = (table: Record<string, number>) => Object.values(table).reduce((sum, value) => sum + value, 0);
    for (const [growths, caps] of [
      [SOLDIER_GROWTHS, SOLDIER_CAPS],
      [ARCHER_GROWTHS, ARCHER_CAPS],
    ]) {
      for (const stat of GROWTH_STATS) {
        expect(WARRIOR_GROWTHS[stat]).toBeGreaterThanOrEqual(growths[stat]);
        expect(WARRIOR_CAPS[stat]).toBeGreaterThanOrEqual(caps[stat]);
      }
      expect(total(WARRIOR_GROWTHS)).toBeGreaterThan(total(growths));
      expect(total(WARRIOR_CAPS)).toBeGreaterThan(total(caps));
    }
  });

  it('earns XP half again as fast as other classes', () => {
    expect(WARRIOR_EXPERIENCE_RATE).toBe(150);
    const warrior = new Warrior({ team: 'player' });
    expect(warrior.experienceRate).toBe(WARRIOR_EXPERIENCE_RATE);
    expect(warrior.gainExperience(20, () => 0)).toMatchObject({ amount: 30, level: 1, experience: 30 });
    expect(
      new Unit({ name: 'Plain', health: 10, strength: 1, defense: 0, movement: 5, team: 'player' }).experienceRate,
    ).toBe(DEFAULT_EXPERIENCE_RATE);
  });

  it('reaches a level a soldier would still be working toward', () => {
    const warrior = new Warrior({ team: 'player' });
    warrior.gainExperience(40, () => 0);
    expect(warrior.level).toBe(2);
    expect(warrior.experience).toBe(10);
  });
});
