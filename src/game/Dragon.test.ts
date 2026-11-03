import { describe, expect, it } from 'vitest';
import { getLearnedSkills } from './skills.ts';
import { DRAGON_GROWTHS, DRAGON_ITEMS, DRAGON_STATS, Dragon } from './Dragon.ts';
import { Unit } from './Unit.ts';
import { FIRE_BREATH } from './weapons.ts';

describe('Dragon', () => {
  it('is a Unit of the dragon class', () => {
    const dragon = new Dragon({ team: 'enemy' });
    expect(dragon).toBeInstanceOf(Unit);
    expect(dragon.unitClass).toBe('dragon');
    expect(dragon.name).toBe('Dragon');
    expect(dragon.team).toBe('enemy');
    expect(dragon.level).toBe(1);
  });

  it('uses the dragon stat line, with no mana', () => {
    const dragon = new Dragon({ team: 'enemy' });
    expect(dragon.maxHealth).toBe(DRAGON_STATS.health);
    expect(dragon.health).toBe(DRAGON_STATS.health);
    expect(dragon.maxMana).toBe(0);
    expect(dragon.strength).toBe(DRAGON_STATS.strength);
    expect(dragon.dexterity).toBe(DRAGON_STATS.dexterity);
    expect(dragon.speed).toBe(DRAGON_STATS.speed);
    expect(dragon.luck).toBe(DRAGON_STATS.luck);
    expect(dragon.defense).toBe(DRAGON_STATS.defense);
    expect(dragon.resistance).toBe(DRAGON_STATS.resistance);
    expect(dragon.movement).toBe(DRAGON_STATS.movement);
  });

  it('breathes fire up to two tiles away, never running out, and carries nothing else', () => {
    const dragon = new Dragon({ team: 'enemy' });
    expect(dragon.weapon).toBe(FIRE_BREATH);
    expect([dragon.weapon!.minRange, dragon.weapon!.maxRange]).toEqual([1, 2]);
    expect(dragon.innate).toEqual(DRAGON_ITEMS.map(({ item }) => item));
    expect(dragon.items).toEqual([]);
  });

  it('levels up with the dragon growth rates', () => {
    const dragon = new Dragon({ team: 'enemy' });
    expect(dragon.growths).toBe(DRAGON_GROWTHS);
  });

  it('learns no skills', () => {
    expect(getLearnedSkills('dragon', 20)).toEqual([]);
  });

  it('accepts a custom name, level and items', () => {
    const dragon = new Dragon({ name: 'Enemy Dragon', team: 'enemy', level: 3, items: [] });
    expect(dragon.name).toBe('Enemy Dragon');
    expect(dragon.level).toBe(3);
    expect(dragon.items).toEqual([]);
  });
});
