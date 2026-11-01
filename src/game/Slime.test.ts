import { describe, expect, it } from 'vitest';
import { getLearnedSkills } from './skills.ts';
import { SLIME_CAPS, SLIME_GROWTHS, SLIME_ITEMS, SLIME_STATS, Slime } from './Slime.ts';
import { Unit } from './Unit.ts';
import { TACKLE } from './weapons.ts';

describe('Slime', () => {
  it('is a Unit of the slime class', () => {
    const slime = new Slime({ team: 'enemy' });
    expect(slime).toBeInstanceOf(Unit);
    expect(slime.unitClass).toBe('slime');
    expect(slime.name).toBe('Slime');
    expect(slime.team).toBe('enemy');
    expect(slime.level).toBe(1);
  });

  it('uses the slime stat line, with no mana', () => {
    const slime = new Slime({ team: 'enemy' });
    expect(slime.maxHealth).toBe(SLIME_STATS.health);
    expect(slime.health).toBe(SLIME_STATS.health);
    expect(slime.maxMana).toBe(0);
    expect(slime.strength).toBe(SLIME_STATS.strength);
    expect(slime.skill).toBe(SLIME_STATS.skill);
    expect(slime.speed).toBe(SLIME_STATS.speed);
    expect(slime.luck).toBe(SLIME_STATS.luck);
    expect(slime.defense).toBe(SLIME_STATS.defense);
    expect(slime.resistance).toBe(SLIME_STATS.resistance);
    expect(slime.movement).toBe(SLIME_STATS.movement);
  });

  it('fights with its Tackle, which never breaks, and carries nothing else', () => {
    const slime = new Slime({ team: 'enemy' });
    expect(slime.weapon).toBe(TACKLE);
    expect(slime.weaponUses).toBeNull();
    expect(slime.items).toEqual(SLIME_ITEMS);
    expect(slime.items).toHaveLength(1);
  });

  it('levels up with the slime growth rates and caps', () => {
    const slime = new Slime({ team: 'enemy' });
    expect(slime.growths).toBe(SLIME_GROWTHS);
    expect(slime.caps).toBe(SLIME_CAPS);
  });

  it('learns no skills', () => {
    expect(getLearnedSkills('slime', 20)).toEqual([]);
  });

  it('accepts a custom name, level and items', () => {
    const slime = new Slime({ name: 'Enemy Slime', team: 'enemy', level: 3, items: [] });
    expect(slime.name).toBe('Enemy Slime');
    expect(slime.level).toBe(3);
    expect(slime.items).toEqual([]);
  });
});
