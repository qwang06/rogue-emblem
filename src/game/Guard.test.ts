import { describe, expect, it } from 'vitest';
import { calculateDamage } from './combat.ts';
import { getAttackSpeed } from './combatStats.ts';
import { GUARD_CAPS, GUARD_GROWTHS, GUARD_ITEMS, GUARD_STATS, Guard } from './Guard.ts';
import { HEALTH_POTION, MANA_POTION } from './items.ts';
import { getLearnedSkills, SHIELD_BASH } from './skills.ts';
import { Soldier } from './Soldier.ts';
import { Unit } from './Unit.ts';
import { Wizard } from './Wizard.ts';
import { FIRE, IRON_SPEAR, weaponEntry } from './weapons.ts';

describe('Guard', () => {
  it('is a Unit of the guard class', () => {
    const guard = new Guard({ team: 'player' });
    expect(guard).toBeInstanceOf(Unit);
    expect(guard.unitClass).toBe('guard');
    expect(guard.name).toBe('Guard');
    expect(guard.team).toBe('player');
    expect(guard.level).toBe(1);
  });

  it('uses the guard stat line', () => {
    const guard = new Guard({ team: 'enemy' });
    expect(guard.maxHealth).toBe(GUARD_STATS.health);
    expect(guard.maxMana).toBe(GUARD_STATS.mana);
    expect(guard.strength).toBe(GUARD_STATS.strength);
    expect(guard.magic).toBe(GUARD_STATS.magic);
    expect(guard.skill).toBe(GUARD_STATS.skill);
    expect(guard.speed).toBe(GUARD_STATS.speed);
    expect(guard.luck).toBe(GUARD_STATS.luck);
    expect(guard.defense).toBe(GUARD_STATS.defense);
    expect(guard.resistance).toBe(GUARD_STATS.resistance);
    expect(guard.movement).toBe(GUARD_STATS.movement);
  });

  it('levels up with the guard growth rates and caps', () => {
    const guard = new Guard({ team: 'player' });
    expect(guard.growths).toBe(GUARD_GROWTHS);
    expect(guard.caps).toBe(GUARD_CAPS);
  });

  it('wields physical weapons only', () => {
    const guard = new Guard({ team: 'player', items: [weaponEntry(FIRE)] });
    expect(guard.weaponTypes).toEqual(['physical']);
    expect(guard.weapon).toBeNull();
  });

  it('carries an Iron Spear, a health potion and a mana potion', () => {
    const guard = new Guard({ team: 'player' });
    expect(guard.items).toEqual(GUARD_ITEMS);
    expect(guard.items.map((entry) => entry.item)).toEqual([IRON_SPEAR, HEALTH_POTION, MANA_POTION]);
    expect(guard.weapon).toBe(IRON_SPEAR);
  });

  it('learns Shield Bash at level 2', () => {
    expect(getLearnedSkills('guard', 1)).toEqual([]);
    expect(getLearnedSkills('guard', 2)).toEqual([SHIELD_BASH]);
  });

  it('accepts a custom name and level', () => {
    const guard = new Guard({ name: 'Enemy Guard', team: 'enemy', level: 4 });
    expect(guard.name).toBe('Enemy Guard');
    expect(guard.level).toBe(4);
  });

  it('moves one tile less than a soldier and is slower', () => {
    const guard = new Guard({ team: 'player' });
    const soldier = new Soldier({ team: 'enemy' });
    expect(guard.movement).toBe(soldier.movement - 1);
    expect(getAttackSpeed(guard)).toBeLessThan(getAttackSpeed(soldier));
  });

  it("takes no damage from a soldier's spear", () => {
    expect(calculateDamage(new Soldier({ team: 'enemy' }), new Guard({ team: 'player' }))).toBe(0);
  });

  it('has no answer to magic', () => {
    const wizard = new Wizard({ team: 'enemy' });
    expect(calculateDamage(wizard, new Guard({ team: 'player' }))).toBe(wizard.magic + FIRE.might);
  });
});
