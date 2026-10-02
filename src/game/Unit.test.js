import { describe, expect, it } from 'vitest';
import { HEALTH_POTION, MANA_POTION } from './items.js';
import { Unit } from './Unit.js';

function makeUnit(overrides = {}) {
  return new Unit({
    name: 'Soldier',
    health: 10,
    mana: 5,
    strength: 4,
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
    expect(unit.strength).toBe(4);
    expect(unit.defense).toBe(2);
    expect(unit.movement).toBe(5);
    expect(unit.team).toBe('player');
    expect(unit.mana).toBe(5);
    expect(unit.maxMana).toBe(5);
  });

  it('defaults to level 1, no class, and no mana', () => {
    const unit = new Unit({ name: 'Blob', health: 1, strength: 0, defense: 0, movement: 1, team: 'enemy' });
    expect(unit.level).toBe(1);
    expect(unit.unitClass).toBeNull();
    expect(unit.mana).toBe(0);
    expect(unit.maxMana).toBe(0);
  });

  it('defaults magic, skill, speed, luck, and resistance to 0 and deals physical damage', () => {
    const unit = makeUnit();
    expect(unit.magic).toBe(0);
    expect(unit.skill).toBe(0);
    expect(unit.speed).toBe(0);
    expect(unit.luck).toBe(0);
    expect(unit.resistance).toBe(0);
    expect(unit.damageType).toBe('physical');
  });

  it('accepts the expanded stats and a damage type', () => {
    const unit = makeUnit({ magic: 6, skill: 5, speed: 7, luck: 3, resistance: 4, damageType: 'magical' });
    expect(unit.magic).toBe(6);
    expect(unit.skill).toBe(5);
    expect(unit.speed).toBe(7);
    expect(unit.luck).toBe(3);
    expect(unit.resistance).toBe(4);
    expect(unit.damageType).toBe('magical');
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

  describe('items', () => {
    it('carries no items by default', () => {
      expect(makeUnit().items).toEqual([]);
    });

    it('starts with the items it was given, as a frozen inventory', () => {
      const unit = makeUnit({ items: [{ item: HEALTH_POTION, quantity: 2 }] });
      expect(unit.items).toEqual([{ item: HEALTH_POTION, quantity: 2 }]);
      expect(Object.isFrozen(unit.items)).toBe(true);
    });
  });

  describe('useItem', () => {
    const stocked = () =>
      makeUnit({
        items: [
          { item: HEALTH_POTION, quantity: 2 },
          { item: MANA_POTION, quantity: 1 },
        ],
      });

    it('restores health with a health potion and uses one up', () => {
      const unit = stocked();
      unit.takeDamage(7);
      expect(unit.useItem('health-potion')).toEqual({ item: HEALTH_POTION, amount: HEALTH_POTION.amount });
      expect(unit.health).toBe(3 + HEALTH_POTION.amount);
      expect(unit.items[0].quantity).toBe(1);
    });

    it('restores mana with a mana potion and drops the empty entry', () => {
      const unit = stocked();
      unit.spendMana(5);
      expect(unit.useItem('mana-potion').amount).toBe(MANA_POTION.amount);
      expect(unit.mana).toBe(MANA_POTION.amount);
      expect(unit.items.map((entry) => entry.item)).toEqual([HEALTH_POTION]);
    });

    it('reports only what was actually restored near the maximum', () => {
      const unit = stocked();
      unit.takeDamage(1);
      expect(unit.useItem('health-potion').amount).toBe(1);
      expect(unit.health).toBe(unit.maxHealth);
    });

    it('still uses the item up when it restores nothing', () => {
      const unit = stocked();
      expect(unit.useItem('mana-potion').amount).toBe(0);
      expect(unit.mana).toBe(5);
      expect(unit.items).toHaveLength(1);
    });

    it('throws for an item it does not carry, changing nothing', () => {
      const unit = makeUnit();
      unit.takeDamage(5);
      expect(() => unit.useItem('health-potion')).toThrow();
      expect(unit.health).toBe(5);
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
