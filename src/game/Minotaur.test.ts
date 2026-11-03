import { describe, expect, it } from 'vitest';
import { getLearnedSkills } from './skills.ts';
import { MINOTAUR_GROWTHS, MINOTAUR_ITEMS, MINOTAUR_STATS, Minotaur } from './Minotaur.ts';
import { Unit } from './Unit.ts';
import { GREAT_AXE } from './weapons.ts';

describe('Minotaur', () => {
  it('is a Unit of the minotaur class', () => {
    const minotaur = new Minotaur({ team: 'enemy' });
    expect(minotaur).toBeInstanceOf(Unit);
    expect(minotaur.unitClass).toBe('minotaur');
    expect(minotaur.name).toBe('Minotaur');
    expect(minotaur.team).toBe('enemy');
    expect(minotaur.level).toBe(1);
  });

  it('uses the minotaur stat line, with no mana', () => {
    const minotaur = new Minotaur({ team: 'enemy' });
    expect(minotaur.maxHealth).toBe(MINOTAUR_STATS.health);
    expect(minotaur.health).toBe(MINOTAUR_STATS.health);
    expect(minotaur.maxMana).toBe(0);
    expect(minotaur.strength).toBe(MINOTAUR_STATS.strength);
    expect(minotaur.skill).toBe(MINOTAUR_STATS.skill);
    expect(minotaur.speed).toBe(MINOTAUR_STATS.speed);
    expect(minotaur.luck).toBe(MINOTAUR_STATS.luck);
    expect(minotaur.defense).toBe(MINOTAUR_STATS.defense);
    expect(minotaur.resistance).toBe(MINOTAUR_STATS.resistance);
    expect(minotaur.movement).toBe(MINOTAUR_STATS.movement);
  });

  it('fights with its Great Axe, which never breaks, and carries nothing else', () => {
    const minotaur = new Minotaur({ team: 'enemy' });
    expect(minotaur.weapon).toBe(GREAT_AXE);
    expect(minotaur.weaponUses).toBeNull();
    expect(minotaur.items).toEqual(MINOTAUR_ITEMS);
    expect(minotaur.items).toHaveLength(1);
  });

  it('levels up with the minotaur growth rates', () => {
    const minotaur = new Minotaur({ team: 'enemy' });
    expect(minotaur.growths).toBe(MINOTAUR_GROWTHS);
  });

  it('learns no skills', () => {
    expect(getLearnedSkills('minotaur', 20)).toEqual([]);
  });

  it('accepts a custom name, level and items', () => {
    const minotaur = new Minotaur({ name: 'Enemy Minotaur', team: 'enemy', level: 3, items: [] });
    expect(minotaur.name).toBe('Enemy Minotaur');
    expect(minotaur.level).toBe(3);
    expect(minotaur.items).toEqual([]);
  });
});
