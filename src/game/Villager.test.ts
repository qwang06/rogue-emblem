import { describe, expect, it } from 'vitest';
import { STARTING_ITEMS } from './items.ts';
import { THROW_STONES, getLearnedSkills } from './skills.ts';
import { Unit } from './Unit.ts';
import { VILLAGER_CAPS, VILLAGER_GROWTHS, VILLAGER_STATS, Villager } from './Villager.ts';

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

  it('carries the starting items by default', () => {
    const villager = new Villager({ team: 'player' });
    expect(villager.items).toEqual(STARTING_ITEMS);
  });

  it('knows Throw Stones from level 1', () => {
    expect(getLearnedSkills('villager', 1)).toEqual([THROW_STONES]);
  });
});
