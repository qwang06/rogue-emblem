import { describe, expect, it } from 'vitest';
import { getLearnedSkills } from './skills.ts';
import { ORC_CAPS, ORC_GROWTHS, ORC_ITEMS, ORC_STATS, Orc } from './Orc.ts';
import { Unit } from './Unit.ts';
import { GREAT_AXE } from './weapons.ts';

describe('Orc', () => {
  it('is a Unit of the orc class', () => {
    const orc = new Orc({ team: 'enemy' });
    expect(orc).toBeInstanceOf(Unit);
    expect(orc.unitClass).toBe('orc');
    expect(orc.name).toBe('Orc');
    expect(orc.team).toBe('enemy');
    expect(orc.level).toBe(1);
  });

  it('uses the orc stat line, with no mana', () => {
    const orc = new Orc({ team: 'enemy' });
    expect(orc.maxHealth).toBe(ORC_STATS.health);
    expect(orc.health).toBe(ORC_STATS.health);
    expect(orc.maxMana).toBe(0);
    expect(orc.strength).toBe(ORC_STATS.strength);
    expect(orc.skill).toBe(ORC_STATS.skill);
    expect(orc.speed).toBe(ORC_STATS.speed);
    expect(orc.luck).toBe(ORC_STATS.luck);
    expect(orc.defense).toBe(ORC_STATS.defense);
    expect(orc.resistance).toBe(ORC_STATS.resistance);
    expect(orc.movement).toBe(ORC_STATS.movement);
  });

  it('fights with its Great Axe, which never breaks, and carries nothing else', () => {
    const orc = new Orc({ team: 'enemy' });
    expect(orc.weapon).toBe(GREAT_AXE);
    expect(orc.weaponUses).toBeNull();
    expect(orc.items).toEqual(ORC_ITEMS);
    expect(orc.items).toHaveLength(1);
  });

  it('levels up with the orc growth rates and caps', () => {
    const orc = new Orc({ team: 'enemy' });
    expect(orc.growths).toBe(ORC_GROWTHS);
    expect(orc.caps).toBe(ORC_CAPS);
  });

  it('learns no skills', () => {
    expect(getLearnedSkills('orc', 20)).toEqual([]);
  });

  it('accepts a custom name, level and items', () => {
    const orc = new Orc({ name: 'Enemy Orc', team: 'enemy', level: 3, items: [] });
    expect(orc.name).toBe('Enemy Orc');
    expect(orc.level).toBe(3);
    expect(orc.items).toEqual([]);
  });
});
