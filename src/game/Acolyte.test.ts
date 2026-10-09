import { describe, expect, it } from 'vitest';
import { ACOLYTE_CAPS, ACOLYTE_GROWTHS, ACOLYTE_ITEMS, ACOLYTE_STATS, Acolyte } from './Acolyte.ts';
import { getCombatForecast } from './combat.ts';
import { getHealAmount, HEAL_STAFF } from './healing.ts';
import { HEALTH_POTION, MANA_POTION } from './items.ts';
import { getLearnedSkills } from './skills.ts';
import { Soldier } from './Soldier.ts';
import { Unit } from './Unit.ts';
import { FIRE, IRON_SPEAR, weaponEntry } from './weapons.ts';

describe('Acolyte', () => {
  it('is a Unit of the acolyte class', () => {
    const acolyte = new Acolyte({ team: 'player' });
    expect(acolyte).toBeInstanceOf(Unit);
    expect(acolyte.unitClass).toBe('acolyte');
    expect(acolyte.name).toBe('Acolyte');
    expect(acolyte.team).toBe('player');
    expect(acolyte.level).toBe(1);
  });

  it('uses the acolyte stat line', () => {
    const acolyte = new Acolyte({ team: 'enemy' });
    expect(acolyte.maxHealth).toBe(ACOLYTE_STATS.health);
    expect(acolyte.maxMana).toBe(ACOLYTE_STATS.mana);
    expect(acolyte.strength).toBe(ACOLYTE_STATS.strength);
    expect(acolyte.magic).toBe(ACOLYTE_STATS.magic);
    expect(acolyte.skill).toBe(ACOLYTE_STATS.skill);
    expect(acolyte.speed).toBe(ACOLYTE_STATS.speed);
    expect(acolyte.luck).toBe(ACOLYTE_STATS.luck);
    expect(acolyte.defense).toBe(ACOLYTE_STATS.defense);
    expect(acolyte.resistance).toBe(ACOLYTE_STATS.resistance);
    expect(acolyte.movement).toBe(ACOLYTE_STATS.movement);
  });

  it('levels up with the acolyte growth rates and caps', () => {
    const acolyte = new Acolyte({ team: 'player' });
    expect(acolyte.growths).toBe(ACOLYTE_GROWTHS);
    expect(acolyte.caps).toBe(ACOLYTE_CAPS);
  });

  it('carries a Heal staff, a health potion and a mana potion', () => {
    const acolyte = new Acolyte({ team: 'player' });
    expect(acolyte.items).toEqual(ACOLYTE_ITEMS);
    expect(acolyte.items.map((entry) => entry.item)).toEqual([HEAL_STAFF, HEALTH_POTION, MANA_POTION]);
  });

  it('wields no weapons, so it has nothing to attack with', () => {
    const acolyte = new Acolyte({ team: 'player', items: [weaponEntry(IRON_SPEAR), weaponEntry(FIRE)] });
    expect(acolyte.weaponTypes).toEqual([]);
    expect(acolyte.weapon).toBeNull();
    expect(new Acolyte({ team: 'player' }).weapon).toBeNull();
  });

  it("can't counter", () => {
    const forecast = getCombatForecast(new Soldier({ team: 'enemy' }), new Acolyte({ team: 'player' }), {
      distance: 1,
    });
    expect(forecast.defender.counters).toBe(false);
  });

  it('heals 5 at level 1', () => {
    expect(getHealAmount(new Acolyte({ team: 'player' }), HEAL_STAFF, { health: 1, maxHealth: 10 })).toBe(5);
  });

  it('knows no skills yet', () => {
    expect(getLearnedSkills('acolyte', 20)).toEqual([]);
  });

  it('accepts a custom name and level', () => {
    const acolyte = new Acolyte({ name: 'Enemy Acolyte', team: 'enemy', level: 4 });
    expect(acolyte.name).toBe('Enemy Acolyte');
    expect(acolyte.level).toBe(4);
  });

  it('spends a staff use per heal', () => {
    const acolyte = new Acolyte({ team: 'player' });
    expect(acolyte.spendStaffUse(0)).toEqual({ staff: HEAL_STAFF, broke: false });
    expect(acolyte.items[0].quantity).toBe(HEAL_STAFF.uses - 1);
    expect(ACOLYTE_ITEMS[0].quantity).toBe(HEAL_STAFF.uses);
  });

  it('loses a staff on its last use', () => {
    const acolyte = new Acolyte({ team: 'player', items: [{ item: HEAL_STAFF, quantity: 1 }] });
    expect(acolyte.spendStaffUse(0)).toEqual({ staff: HEAL_STAFF, broke: true });
    expect(acolyte.items).toEqual([]);
  });
});
