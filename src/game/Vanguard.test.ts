import { describe, expect, it } from 'vitest';
import { VANGUARD_CAPS, VANGUARD_GROWTHS, VANGUARD_ITEMS, VANGUARD_STATS, Vanguard } from './Vanguard.ts';
import { calculateDamage, getCombatForecast } from './combat.ts';
import { getAttackSpeed } from './combatStats.ts';
import { HEALTH_POTION, MANA_POTION } from './items.ts';
import { getLearnedSkills, CLEAVE } from './skills.ts';
import { Soldier } from './Soldier.ts';
import { Unit } from './Unit.ts';
import { FIRE, IRON_AXE, weaponEntry } from './weapons.ts';

describe('Vanguard', () => {
  it('is a Unit of the vanguard class', () => {
    const vanguard = new Vanguard({ team: 'player' });
    expect(vanguard).toBeInstanceOf(Unit);
    expect(vanguard.unitClass).toBe('vanguard');
    expect(vanguard.name).toBe('Vanguard');
    expect(vanguard.team).toBe('player');
    expect(vanguard.level).toBe(1);
  });

  it('uses the vanguard stat line', () => {
    const vanguard = new Vanguard({ team: 'enemy' });
    expect(vanguard.maxHealth).toBe(VANGUARD_STATS.health);
    expect(vanguard.maxMana).toBe(VANGUARD_STATS.mana);
    expect(vanguard.strength).toBe(VANGUARD_STATS.strength);
    expect(vanguard.magic).toBe(VANGUARD_STATS.magic);
    expect(vanguard.skill).toBe(VANGUARD_STATS.skill);
    expect(vanguard.speed).toBe(VANGUARD_STATS.speed);
    expect(vanguard.luck).toBe(VANGUARD_STATS.luck);
    expect(vanguard.defense).toBe(VANGUARD_STATS.defense);
    expect(vanguard.resistance).toBe(VANGUARD_STATS.resistance);
    expect(vanguard.movement).toBe(VANGUARD_STATS.movement);
  });

  it('levels up with the vanguard growth rates and caps', () => {
    const vanguard = new Vanguard({ team: 'player' });
    expect(vanguard.growths).toBe(VANGUARD_GROWTHS);
    expect(vanguard.caps).toBe(VANGUARD_CAPS);
  });

  it('wields physical weapons only', () => {
    const vanguard = new Vanguard({ team: 'player', items: [weaponEntry(FIRE)] });
    expect(vanguard.weaponTypes).toEqual(['physical']);
    expect(vanguard.weapon).toBeNull();
  });

  it('carries an Iron Axe, a health potion and a mana potion', () => {
    const vanguard = new Vanguard({ team: 'player' });
    expect(vanguard.items).toEqual(VANGUARD_ITEMS);
    expect(vanguard.items.map((entry) => entry.item)).toEqual([IRON_AXE, HEALTH_POTION, MANA_POTION]);
    expect(vanguard.weapon).toBe(IRON_AXE);
    expect(vanguard.weaponUses).toBe(IRON_AXE.uses);
  });

  it('learns Cleave at level 2', () => {
    expect(getLearnedSkills('vanguard', 1)).toEqual([]);
    expect(getLearnedSkills('vanguard', 2)).toEqual([CLEAVE]);
  });

  it('accepts a custom name and level', () => {
    const vanguard = new Vanguard({ name: 'Enemy Vanguard', team: 'enemy', level: 4 });
    expect(vanguard.name).toBe('Enemy Vanguard');
    expect(vanguard.level).toBe(4);
  });

  it('swings its axe unslowed and hits a soldier harder than a soldier hits it', () => {
    const vanguard = new Vanguard({ team: 'player' });
    const soldier = new Soldier({ team: 'enemy' });
    expect(getAttackSpeed(vanguard)).toBe(vanguard.speed);
    expect(calculateDamage(vanguard, soldier)).toBeGreaterThan(calculateDamage(soldier, vanguard));
  });

  it('trades blows with a soldier on the next tile', () => {
    const forecast = getCombatForecast(new Vanguard({ team: 'player' }), new Soldier({ team: 'enemy' }), {
      distance: 1,
    });
    expect(forecast.attacker.strikes).toBe(1);
    expect(forecast.defender.counters).toBe(true);
  });
});
