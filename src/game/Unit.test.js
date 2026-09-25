import { describe, expect, it } from 'vitest';
import { Unit } from './Unit.js';

function makeUnit(overrides = {}) {
  return new Unit({
    name: 'Soldier',
    health: 10,
    mana: 5,
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
    expect(unit.mana).toBe(5);
    expect(unit.maxMana).toBe(5);
  });

  it('defaults to level 1, no class, and no mana', () => {
    const unit = new Unit({ name: 'Blob', health: 1, attack: 0, defense: 0, movement: 1, team: 'enemy' });
    expect(unit.level).toBe(1);
    expect(unit.unitClass).toBeNull();
    expect(unit.mana).toBe(0);
    expect(unit.maxMana).toBe(0);
  });

  it('accepts an explicit class and level', () => {
    const unit = makeUnit({ unitClass: 'soldier', level: 4 });
    expect(unit.unitClass).toBe('soldier');
    expect(unit.level).toBe(4);
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

  describe('spendMana', () => {
    it('reduces mana by the given amount', () => {
      const unit = makeUnit();
      expect(unit.spendMana(3)).toBe(2);
      expect(unit.mana).toBe(2);
    });

    it('can spend exactly all remaining mana', () => {
      const unit = makeUnit();
      unit.spendMana(5);
      expect(unit.mana).toBe(0);
    });

    it('throws and leaves mana unchanged when the unit cannot afford it', () => {
      const unit = makeUnit();
      expect(() => unit.spendMana(6)).toThrow();
      expect(unit.mana).toBe(5);
    });
  });

  describe('restoreMana', () => {
    it('increases mana by the given amount', () => {
      const unit = makeUnit();
      unit.spendMana(4);
      unit.restoreMana(2);
      expect(unit.mana).toBe(3);
    });

    it('does not raise mana above maxMana', () => {
      const unit = makeUnit();
      unit.spendMana(1);
      unit.restoreMana(999);
      expect(unit.mana).toBe(unit.maxMana);
    });
  });

  describe('levelUp', () => {
    it('raises the level by one', () => {
      const unit = makeUnit();
      expect(unit.levelUp()).toBe(2);
      expect(unit.level).toBe(2);
    });
  });
});
