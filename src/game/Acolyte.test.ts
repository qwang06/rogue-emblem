import { describe, expect, it } from 'vitest';
import { ACOLYTE_GROWTHS, ACOLYTE_ITEMS, ACOLYTE_STATS, Acolyte } from './Acolyte.ts';
import { getCombatForecast } from './combat.ts';
import { getHealAmount, HEAL_STAFF, staffEntry } from './healing.ts';
import { HEALTH_POTION, MANA_POTION } from './items.ts';
import { getLearnedSkills, MEND } from './skills.ts';
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
    expect(acolyte.intelligence).toBe(ACOLYTE_STATS.intelligence);
    expect(acolyte.dexterity).toBe(ACOLYTE_STATS.dexterity);
    expect(acolyte.speed).toBe(ACOLYTE_STATS.speed);
    expect(acolyte.luck).toBe(ACOLYTE_STATS.luck);
    expect(acolyte.defense).toBe(ACOLYTE_STATS.defense);
    expect(acolyte.resistance).toBe(ACOLYTE_STATS.resistance);
    expect(acolyte.movement).toBe(ACOLYTE_STATS.movement);
  });

  it('levels up with the acolyte growth rates', () => {
    const acolyte = new Acolyte({ team: 'player' });
    expect(acolyte.growths).toBe(ACOLYTE_GROWTHS);
  });

  it('knows Light, holds a Heal staff and carries a health potion and a mana potion', () => {
    const acolyte = new Acolyte({ team: 'player' });
    expect(ACOLYTE_ITEMS.map((entry) => entry.item)).toEqual([LIGHT, HEAL_STAFF, HEALTH_POTION, MANA_POTION]);
    expect(acolyte.innate).toEqual([LIGHT]);
    expect(acolyte.equipment).toEqual({ main: HEAL_STAFF });
    expect(acolyte.items.map((entry) => entry.item)).toEqual([HEALTH_POTION, MANA_POTION]);
  });

  it('is trained in staves and tomes, and fights with Light', () => {
    expect(new Acolyte({ team: 'player' }).weapon).toBe(LIGHT);
    const acolyte = new Acolyte({ team: 'player', items: [weaponEntry(FIRE), weaponEntry(IRON_SPEAR)] });
    expect(acolyte.weaponTypes).toEqual(['staff', 'tome']);
    expect(acolyte.weapon).toBe(FIRE);
  });

  it('casts Light from one or two tiles away, hitting a soldier for 2 (its Shield Wall takes 1 off)', () => {
    for (const distance of [1, 2]) {
      const forecast = getCombatForecast(new Acolyte({ team: 'player' }), new Soldier({ team: 'enemy' }), {
        distance,
      });
      expect(forecast.attacker.damage).toBe(2);
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
    for (let strike = 0; strike < 50; strike++) acolyte.recordStrike();
    expect(acolyte.weapon).toBe(LIGHT);
    expect(NATURAL_WEAPON_IDS.has(LIGHT.id)).toBe(true);
  });

  it('heals 5 at level 1', () => {
    expect(getHealAmount(new Acolyte({ team: 'player' }), HEAL_STAFF, { health: 1, maxHealth: 10 })).toBe(5);
  });

  it('learns Mend at level 2', () => {
    expect(getLearnedSkills('acolyte', 1)).toEqual([]);
    expect(getLearnedSkills('acolyte', 2)).toEqual([MEND]);
  });

  it('accepts a custom name and level', () => {
    const acolyte = new Acolyte({ name: 'Enemy Acolyte', team: 'enemy', level: 4 });
    expect(acolyte.name).toBe('Enemy Acolyte');
    expect(acolyte.level).toBe(4);
  });

  it('heals with the staff in its main hand', () => {
    expect(new Acolyte({ team: 'player' }).staves).toEqual([{ staff: HEAL_STAFF, index: 0 }]);
  });
});
