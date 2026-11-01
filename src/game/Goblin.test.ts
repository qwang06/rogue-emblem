import { describe, expect, it } from 'vitest';
import { getLearnedSkills } from './skills.ts';
import { GOBLIN_CAPS, GOBLIN_GROWTHS, GOBLIN_ITEMS, GOBLIN_STATS, Goblin } from './Goblin.ts';
import { Unit } from './Unit.ts';
import { CLUB } from './weapons.ts';

describe('Goblin', () => {
  it('is a Unit of the goblin class', () => {
    const goblin = new Goblin({ team: 'enemy' });
    expect(goblin).toBeInstanceOf(Unit);
    expect(goblin.unitClass).toBe('goblin');
    expect(goblin.name).toBe('Goblin');
    expect(goblin.team).toBe('enemy');
    expect(goblin.level).toBe(1);
  });

  it('uses the goblin stat line, with no mana', () => {
    const goblin = new Goblin({ team: 'enemy' });
    expect(goblin.maxHealth).toBe(GOBLIN_STATS.health);
    expect(goblin.health).toBe(GOBLIN_STATS.health);
    expect(goblin.maxMana).toBe(0);
    expect(goblin.strength).toBe(GOBLIN_STATS.strength);
    expect(goblin.skill).toBe(GOBLIN_STATS.skill);
    expect(goblin.speed).toBe(GOBLIN_STATS.speed);
    expect(goblin.luck).toBe(GOBLIN_STATS.luck);
    expect(goblin.defense).toBe(GOBLIN_STATS.defense);
    expect(goblin.resistance).toBe(GOBLIN_STATS.resistance);
    expect(goblin.movement).toBe(GOBLIN_STATS.movement);
  });

  it('fights with its Club, which never breaks, and carries nothing else', () => {
    const goblin = new Goblin({ team: 'enemy' });
    expect(goblin.weapon).toBe(CLUB);
    expect(goblin.weaponUses).toBeNull();
    expect(goblin.items).toEqual(GOBLIN_ITEMS);
    expect(goblin.items).toHaveLength(1);
  });

  it('levels up with the goblin growth rates and caps', () => {
    const goblin = new Goblin({ team: 'enemy' });
    expect(goblin.growths).toBe(GOBLIN_GROWTHS);
    expect(goblin.caps).toBe(GOBLIN_CAPS);
  });

  it('learns no skills', () => {
    expect(getLearnedSkills('goblin', 20)).toEqual([]);
  });

  it('accepts a custom name, level and items', () => {
    const goblin = new Goblin({ name: 'Enemy Goblin', team: 'enemy', level: 3, items: [] });
    expect(goblin.name).toBe('Enemy Goblin');
    expect(goblin.level).toBe(3);
    expect(goblin.items).toEqual([]);
  });
});
