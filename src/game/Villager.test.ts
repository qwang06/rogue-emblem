import { describe, expect, it } from 'vitest';
import { STARTING_ITEMS } from './items.ts';
import { THROW_STONES, getLearnedSkills } from './skills.ts';
import { Unit } from './Unit.ts';
import { VILLAGER_CAPS, VILLAGER_GROWTHS, VILLAGER_ITEMS, VILLAGER_STATS, Villager } from './Villager.ts';
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
});
