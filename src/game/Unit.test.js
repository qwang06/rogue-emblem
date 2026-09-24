import { describe, expect, it } from 'vitest';
import { Unit } from './Unit.js';

function makeUnit(overrides = {}) {
  return new Unit({
    name: 'Soldier',
    health: 10,
    attack: 4,
    defense: 2,
    movement: 5,
    team: 'player',
    ...overrides,
  });
}

describe('Unit', () => {
  it('initializes from the given stats', () => {
    const unit = makeUnit();
    expect(unit.name).toBe('Soldier');
    expect(unit.health).toBe(10);
    expect(unit.maxHealth).toBe(10);
    expect(unit.attack).toBe(4);
    expect(unit.defense).toBe(2);
    expect(unit.movement).toBe(5);
    expect(unit.team).toBe('player');
  });

  it('defaults range to 1 when not given', () => {
    expect(makeUnit().range).toBe(1);
  });

  it('accepts an explicit range', () => {
    expect(makeUnit({ range: 3 }).range).toBe(3);
  });

  it('is alive when health is above zero', () => {
    expect(makeUnit().isAlive()).toBe(true);
  });

  it('is not alive once health reaches zero', () => {
    const unit = makeUnit();
    unit.takeDamage(10);
    expect(unit.isAlive()).toBe(false);
  });

  describe('takeDamage', () => {
    it('reduces health by the given amount', () => {
      const unit = makeUnit();
      unit.takeDamage(3);
      expect(unit.health).toBe(7);
    });

    it('does not drop health below zero', () => {
      const unit = makeUnit();
      unit.takeDamage(999);
      expect(unit.health).toBe(0);
    });
  });

  describe('heal', () => {
    it('increases health by the given amount', () => {
      const unit = makeUnit();
      unit.takeDamage(6);
      unit.heal(2);
      expect(unit.health).toBe(6);
    });

    it('does not raise health above maxHealth', () => {
      const unit = makeUnit();
      unit.takeDamage(1);
      unit.heal(999);
      expect(unit.health).toBe(unit.maxHealth);
    });
  });
});
