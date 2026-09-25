import { describe, expect, it } from 'vitest';
import { SOLDIER_STATS, Soldier } from './Soldier.js';
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
    expect(soldier.attack).toBe(SOLDIER_STATS.attack);
    expect(soldier.defense).toBe(SOLDIER_STATS.defense);
    expect(soldier.movement).toBe(SOLDIER_STATS.movement);
    expect(soldier.range).toBe(1);
  });

  it('accepts a custom name and level', () => {
    const soldier = new Soldier({ name: 'Enemy Soldier', team: 'enemy', level: 3 });
    expect(soldier.name).toBe('Enemy Soldier');
    expect(soldier.level).toBe(3);
  });
});
