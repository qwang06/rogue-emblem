import { describe, expect, it } from 'vitest';
import { HEALTH_POTION, MANA_POTION, STARTING_ITEMS } from './items.js';
import { SOLDIER_CAPS, SOLDIER_GROWTHS, SOLDIER_STATS, Soldier } from './Soldier.js';
import { Unit } from './Unit.js';

describe('Soldier', () => {
  it('is a Unit of the soldier class', () => {
    const soldier = new Soldier({ team: 'player' });
    expect(soldier).toBeInstanceOf(Unit);
    expect(soldier.unitClass).toBe('soldier');
    expect(soldier.name).toBe('Soldier');
    expect(soldier.team).toBe('player');
  });

  it('starts at level 1 with 5 mana', () => {
    const soldier = new Soldier({ team: 'player' });
    expect(soldier.level).toBe(1);
    expect(soldier.mana).toBe(5);
    expect(soldier.maxMana).toBe(5);
  });

  it('uses the soldier stat line', () => {
    const soldier = new Soldier({ team: 'enemy' });
    expect(soldier.maxHealth).toBe(SOLDIER_STATS.health);
    expect(soldier.strength).toBe(SOLDIER_STATS.strength);
    expect(soldier.magic).toBe(SOLDIER_STATS.magic);
    expect(soldier.skill).toBe(SOLDIER_STATS.skill);
    expect(soldier.speed).toBe(SOLDIER_STATS.speed);
    expect(soldier.luck).toBe(SOLDIER_STATS.luck);
    expect(soldier.defense).toBe(SOLDIER_STATS.defense);
    expect(soldier.resistance).toBe(SOLDIER_STATS.resistance);
    expect(soldier.damageType).toBe('physical');
    expect(soldier.movement).toBe(SOLDIER_STATS.movement);
    expect(soldier.range).toBe(1);
  });

  it('levels up with the soldier growth rates and caps', () => {
    const soldier = new Soldier({ team: 'player' });
    expect(soldier.growths).toBe(SOLDIER_GROWTHS);
    expect(soldier.caps).toBe(SOLDIER_CAPS);
    expect(soldier.experience).toBe(0);
  });

  it('accepts a custom name and level', () => {
    const soldier = new Soldier({ name: 'Enemy Soldier', team: 'enemy', level: 3 });
    expect(soldier.name).toBe('Enemy Soldier');
    expect(soldier.level).toBe(3);
  });

  it('carries a health potion and a mana potion', () => {
    const soldier = new Soldier({ team: 'player' });
    expect(soldier.items).toEqual(STARTING_ITEMS);
    expect(soldier.items.map((entry) => entry.item)).toEqual([HEALTH_POTION, MANA_POTION]);
  });

  it('can be given other items', () => {
    expect(new Soldier({ team: 'enemy', items: [] }).items).toEqual([]);
  });

  it("doesn't share its inventory with other soldiers", () => {
    const a = new Soldier({ team: 'player' });
    const b = new Soldier({ team: 'player' });
    a.health = 1;
    a.useItem('health-potion');
    expect(b.items).toEqual(STARTING_ITEMS);
  });
});
