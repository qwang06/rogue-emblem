import { describe, expect, it } from 'vitest';
import { ARCHER_GROWTHS, ARCHER_ITEMS, ARCHER_STATS, Archer } from './Archer.ts';
import { getCombatForecast } from './combat.ts';
import { HEALTH_POTION, MANA_POTION } from './items.ts';
import { getLearnedSkills, LONG_SHOT, THROW_STONES } from './skills.ts';
import { Soldier } from './Soldier.ts';
import { Unit } from './Unit.ts';
import { FIRE, IRON_BOW, weaponEntry } from './weapons.ts';

describe('Archer', () => {
  it('is a Unit of the archer class', () => {
    const archer = new Archer({ team: 'player' });
    expect(archer).toBeInstanceOf(Unit);
    expect(archer.unitClass).toBe('archer');
    expect(archer.name).toBe('Archer');
    expect(archer.team).toBe('player');
    expect(archer.level).toBe(1);
  });

  it('uses the archer stat line', () => {
    const archer = new Archer({ team: 'enemy' });
    expect(archer.maxHealth).toBe(ARCHER_STATS.health);
    expect(archer.maxMana).toBe(ARCHER_STATS.mana);
    expect(archer.strength).toBe(ARCHER_STATS.strength);
    expect(archer.intelligence).toBe(ARCHER_STATS.intelligence);
    expect(archer.dexterity).toBe(ARCHER_STATS.dexterity);
    expect(archer.speed).toBe(ARCHER_STATS.speed);
    expect(archer.luck).toBe(ARCHER_STATS.luck);
    expect(archer.defense).toBe(ARCHER_STATS.defense);
    expect(archer.resistance).toBe(ARCHER_STATS.resistance);
    expect(archer.movement).toBe(ARCHER_STATS.movement);
  });

  it('levels up with the archer growth rates', () => {
    const archer = new Archer({ team: 'player' });
    expect(archer.growths).toBe(ARCHER_GROWTHS);
  });

  it('is trained in its families and wields any weapon', () => {
    const archer = new Archer({ team: 'player', items: [weaponEntry(FIRE)] });
    expect(archer.weaponTypes).toEqual(['bow', 'dagger']);
    expect(archer.weapon).toBe(FIRE);
  });

  it('carries an Iron Bow, a health potion and a mana potion', () => {
    const archer = new Archer({ team: 'player' });
    expect(ARCHER_ITEMS.map((entry) => entry.item)).toEqual([IRON_BOW, HEALTH_POTION, MANA_POTION]);
    expect(archer.equipment).toEqual({ main: IRON_BOW });
    expect(archer.items.map((entry) => entry.item)).toEqual([HEALTH_POTION, MANA_POTION]);
    expect(archer.weapon).toBe(IRON_BOW);
  });

  it("learns Long Shot at level 2, keeping the villager's Throw Stones", () => {
    expect(getLearnedSkills('archer', 1)).toEqual([]);
    expect(getLearnedSkills('archer', 2)).toEqual([THROW_STONES, LONG_SHOT]);
  });

  it('accepts a custom name and level', () => {
    const archer = new Archer({ name: 'Enemy Archer', team: 'enemy', level: 4 });
    expect(archer.name).toBe('Enemy Archer');
    expect(archer.level).toBe(4);
  });

  it('shoots from two tiles away and takes no counter from a soldier', () => {
    const forecast = getCombatForecast(new Archer({ team: 'player' }), new Soldier({ team: 'enemy' }), {
      distance: 2,
    });
    expect(forecast.attacker.strikes).toBe(1);
    expect(forecast.defender.counters).toBe(false);
  });

  it("can't counter a soldier striking from the next tile", () => {
    const forecast = getCombatForecast(new Soldier({ team: 'enemy' }), new Archer({ team: 'player' }), {
      distance: 1,
    });
    expect(forecast.defender.counters).toBe(false);
    expect(forecast.defender.strikes).toBe(0);
  });
});
