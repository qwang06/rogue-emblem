import { describe, expect, it } from 'vitest';
import { getLearnedSkills } from './skills.ts';
import { TROLL_GROWTHS, TROLL_ITEMS, TROLL_STATS, Troll } from './Troll.ts';
import { Unit } from './Unit.ts';
import { STONE_MAUL } from './weapons.ts';

describe('Troll', () => {
  it('is a Unit of the troll class', () => {
    const troll = new Troll({ team: 'enemy' });
    expect(troll).toBeInstanceOf(Unit);
    expect(troll.unitClass).toBe('troll');
    expect(troll.name).toBe('Troll');
    expect(troll.team).toBe('enemy');
    expect(troll.level).toBe(1);
  });

  it('uses the troll stat line, with no mana', () => {
    const troll = new Troll({ team: 'enemy' });
    expect(troll.maxHealth).toBe(TROLL_STATS.health);
    expect(troll.health).toBe(TROLL_STATS.health);
    expect(troll.maxMana).toBe(0);
    expect(troll.strength).toBe(TROLL_STATS.strength);
    expect(troll.skill).toBe(TROLL_STATS.skill);
    expect(troll.speed).toBe(TROLL_STATS.speed);
    expect(troll.luck).toBe(TROLL_STATS.luck);
    expect(troll.defense).toBe(TROLL_STATS.defense);
    expect(troll.resistance).toBe(TROLL_STATS.resistance);
    expect(troll.movement).toBe(TROLL_STATS.movement);
  });

  it('fights with its Stone Maul, which never breaks, and carries nothing else', () => {
    const troll = new Troll({ team: 'enemy' });
    expect(troll.weapon).toBe(STONE_MAUL);
    expect(troll.weaponUses).toBeNull();
    expect(troll.items).toEqual(TROLL_ITEMS);
    expect(troll.items).toHaveLength(1);
  });

  it('levels up with the troll growth rates', () => {
    const troll = new Troll({ team: 'enemy' });
    expect(troll.growths).toBe(TROLL_GROWTHS);
  });

  it('learns no skills', () => {
    expect(getLearnedSkills('troll', 20)).toEqual([]);
  });

  it('accepts a custom name, level and items', () => {
    const troll = new Troll({ name: 'Enemy Troll', team: 'enemy', level: 3, items: [] });
    expect(troll.name).toBe('Enemy Troll');
    expect(troll.level).toBe(3);
    expect(troll.items).toEqual([]);
  });
});

describe('Troll regeneration', () => {
  it('carries a phase-heal of 3 HP into every battle', () => {
    expect(new Troll({ team: 'enemy' }).modifiers).toEqual([{ kind: 'phase-heal', amount: 3 }]);
  });
});
