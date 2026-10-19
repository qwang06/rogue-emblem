import { describe, expect, it } from 'vitest';
import { getLearnedSkills } from './skills.ts';
import { BAT_CAPS, BAT_GROWTHS, BAT_ITEMS, BAT_STATS, Bat } from './Bat.ts';
import { Unit } from './Unit.ts';
import { FANGS } from './weapons.ts';

describe('Bat', () => {
  it('is a Unit of the bat class', () => {
    const bat = new Bat({ team: 'enemy' });
    expect(bat).toBeInstanceOf(Unit);
    expect(bat.unitClass).toBe('bat');
    expect(bat.name).toBe('Bat');
    expect(bat.team).toBe('enemy');
    expect(bat.level).toBe(1);
  });

  it('uses the bat stat line, with no mana', () => {
    const bat = new Bat({ team: 'enemy' });
    expect(bat.maxHealth).toBe(BAT_STATS.health);
    expect(bat.health).toBe(BAT_STATS.health);
    expect(bat.maxMana).toBe(0);
    expect(bat.strength).toBe(BAT_STATS.strength);
    expect(bat.skill).toBe(BAT_STATS.skill);
    expect(bat.speed).toBe(BAT_STATS.speed);
    expect(bat.luck).toBe(BAT_STATS.luck);
    expect(bat.defense).toBe(BAT_STATS.defense);
    expect(bat.resistance).toBe(BAT_STATS.resistance);
    expect(bat.movement).toBe(BAT_STATS.movement);
  });

  it('fights with its Fangs, which never breaks, and carries nothing else', () => {
    const bat = new Bat({ team: 'enemy' });
    expect(bat.weapon).toBe(FANGS);
    expect(bat.weaponUses).toBeNull();
    expect(bat.items).toEqual(BAT_ITEMS);
    expect(bat.items).toHaveLength(1);
  });

  it('levels up with the bat growth rates and caps', () => {
    const bat = new Bat({ team: 'enemy' });
    expect(bat.growths).toBe(BAT_GROWTHS);
    expect(bat.caps).toBe(BAT_CAPS);
  });

  it('learns no skills', () => {
    expect(getLearnedSkills('bat', 20)).toEqual([]);
  });

  it('accepts a custom name, level and items', () => {
    const bat = new Bat({ name: 'Enemy Bat', team: 'enemy', level: 3, items: [] });
    expect(bat.name).toBe('Enemy Bat');
    expect(bat.level).toBe(3);
    expect(bat.items).toEqual([]);
  });
});
