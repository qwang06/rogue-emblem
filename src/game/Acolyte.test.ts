import { describe, expect, it } from 'vitest';
import { ACOLYTE_CAPS, ACOLYTE_GROWTHS, ACOLYTE_ITEMS, ACOLYTE_STATS, Acolyte } from './Acolyte.ts';
import { getCombatForecast } from './combat.ts';
import { getHealAmount, HEAL_STAFF, staffEntry } from './healing.ts';
import { HEALTH_POTION, MANA_POTION } from './items.ts';
import { getLearnedSkills } from './skills.ts';
import { Soldier } from './Soldier.ts';
import { Unit } from './Unit.ts';
import { FIRE, IRON_SPEAR, LIGHT, NATURAL_WEAPON_IDS, weaponEntry } from './weapons.ts';

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

  it('knows Light and carries a Heal staff, a health potion and a mana potion', () => {
    const acolyte = new Acolyte({ team: 'player' });
    expect(acolyte.items).toEqual(ACOLYTE_ITEMS);
    expect(acolyte.items.map((entry) => entry.item)).toEqual([LIGHT, HEAL_STAFF, HEALTH_POTION, MANA_POTION]);
  });

  it('wields magical weapons only, starting with Light', () => {
    expect(new Acolyte({ team: 'player' }).weapon).toBe(LIGHT);
    const acolyte = new Acolyte({ team: 'player', items: [weaponEntry(IRON_SPEAR), weaponEntry(FIRE)] });
    expect(acolyte.weaponTypes).toEqual(['magical']);
    expect(acolyte.weapon).toBe(FIRE);
  });

  it('casts Light from one or two tiles away, hitting a soldier for 3', () => {
    for (const distance of [1, 2]) {
      const forecast = getCombatForecast(new Acolyte({ team: 'player' }), new Soldier({ team: 'enemy' }), {
        distance,
      });
      expect(forecast.attacker.damage).toBe(3);
      expect(forecast.attacker.strikes).toBe(1);
    }
    expect([LIGHT.minRange, LIGHT.maxRange]).toEqual([1, 2]);
  });

  it('counters with Light, but not without a weapon', () => {
    const attack = (acolyte: Acolyte, distance: number) =>
      getCombatForecast(new Soldier({ team: 'enemy' }), acolyte, { distance }).defender.counters;
    expect(attack(new Acolyte({ team: 'player' }), 1)).toBe(true);
    expect(attack(new Acolyte({ team: 'player', items: [staffEntry(HEAL_STAFF)] }), 1)).toBe(false);
  });

  it('never wears Light out', () => {
    const acolyte = new Acolyte({ team: 'player' });
    for (let strike = 0; strike < 50; strike++) acolyte.spendWeaponUse();
    expect(acolyte.weapon).toBe(LIGHT);
    expect(NATURAL_WEAPON_IDS.has(LIGHT.id)).toBe(true);
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
    expect(acolyte.spendStaffUse(1)).toEqual({ staff: HEAL_STAFF, broke: false });
    expect(acolyte.items[1].quantity).toBe(HEAL_STAFF.uses - 1);
    expect(ACOLYTE_ITEMS[1].quantity).toBe(HEAL_STAFF.uses);
  });

  it('loses a staff on its last use', () => {
    const acolyte = new Acolyte({ team: 'player', items: [{ item: HEAL_STAFF, quantity: 1 }] });
    expect(acolyte.spendStaffUse(0)).toEqual({ staff: HEAL_STAFF, broke: true });
    expect(acolyte.items).toEqual([]);
  });
});
