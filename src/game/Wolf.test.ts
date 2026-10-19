import { describe, expect, it } from 'vitest';
import { getLearnedSkills } from './skills.ts';
import { WOLF_CAPS, WOLF_GROWTHS, WOLF_ITEMS, WOLF_STATS, Wolf } from './Wolf.ts';
import { Unit } from './Unit.ts';
import { BITE } from './weapons.ts';

describe('Wolf', () => {
  it('is a Unit of the wolf class', () => {
    const wolf = new Wolf({ team: 'enemy' });
    expect(wolf).toBeInstanceOf(Unit);
    expect(wolf.unitClass).toBe('wolf');
    expect(wolf.name).toBe('Wolf');
    expect(wolf.team).toBe('enemy');
    expect(wolf.level).toBe(1);
  });

  it('uses the wolf stat line, with no mana', () => {
    const wolf = new Wolf({ team: 'enemy' });
    expect(wolf.maxHealth).toBe(WOLF_STATS.health);
    expect(wolf.health).toBe(WOLF_STATS.health);
    expect(wolf.maxMana).toBe(0);
    expect(wolf.strength).toBe(WOLF_STATS.strength);
    expect(wolf.skill).toBe(WOLF_STATS.skill);
    expect(wolf.speed).toBe(WOLF_STATS.speed);
    expect(wolf.luck).toBe(WOLF_STATS.luck);
    expect(wolf.defense).toBe(WOLF_STATS.defense);
    expect(wolf.resistance).toBe(WOLF_STATS.resistance);
    expect(wolf.movement).toBe(WOLF_STATS.movement);
  });

  it('fights with its Bite, which never breaks, and carries nothing else', () => {
    const wolf = new Wolf({ team: 'enemy' });
    expect(wolf.weapon).toBe(BITE);
    expect(wolf.weaponUses).toBeNull();
    expect(wolf.items).toEqual(WOLF_ITEMS);
    expect(wolf.items).toHaveLength(1);
  });

  it('levels up with the wolf growth rates and caps', () => {
    const wolf = new Wolf({ team: 'enemy' });
    expect(wolf.growths).toBe(WOLF_GROWTHS);
    expect(wolf.caps).toBe(WOLF_CAPS);
  });

  it('learns no skills', () => {
    expect(getLearnedSkills('wolf', 20)).toEqual([]);
  });

  it('accepts a custom name, level and items', () => {
    const wolf = new Wolf({ name: 'Enemy Wolf', team: 'enemy', level: 3, items: [] });
    expect(wolf.name).toBe('Enemy Wolf');
    expect(wolf.level).toBe(3);
    expect(wolf.items).toEqual([]);
  });
});
