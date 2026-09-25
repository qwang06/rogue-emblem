import { describe, expect, it } from 'vitest';
import {
  HEALTH_POTION,
  MANA_POTION,
  STARTING_ITEMS,
  canUseItem,
  createInventory,
  findItem,
  getItemActions,
  getItemRecovery,
  removeItem,
} from './items.js';

const unitAt = ({ health = 10, maxHealth = 10, mana = 5, maxMana = 5 } = {}) => ({
  health,
  maxHealth,
  mana,
  maxMana,
});

describe('item definitions', () => {
  it('has a health potion and a mana potion that restore something', () => {
    expect(HEALTH_POTION.stat).toBe('health');
    expect(MANA_POTION.stat).toBe('mana');
    expect(HEALTH_POTION.amount).toBeGreaterThan(0);
    expect(MANA_POTION.amount).toBeGreaterThan(0);
  });

  it('starts units with one of each potion', () => {
    expect(STARTING_ITEMS).toEqual([
      { item: HEALTH_POTION, quantity: 1 },
      { item: MANA_POTION, quantity: 1 },
    ]);
  });
});

describe('createInventory', () => {
  it('is empty by default', () => {
    expect(createInventory()).toEqual([]);
  });

  it('drops entries with no items left', () => {
    const inventory = createInventory([
      { item: HEALTH_POTION, quantity: 0 },
      { item: MANA_POTION, quantity: 2 },
    ]);
    expect(inventory).toEqual([{ item: MANA_POTION, quantity: 2 }]);
  });

  it('returns frozen entries detached from the input', () => {
    const entries = [{ item: HEALTH_POTION, quantity: 1 }];
    const inventory = createInventory(entries);
    entries[0].quantity = 5;
    expect(inventory[0].quantity).toBe(1);
    expect(Object.isFrozen(inventory)).toBe(true);
    expect(Object.isFrozen(inventory[0])).toBe(true);
  });
});

describe('findItem', () => {
  const inventory = createInventory(STARTING_ITEMS);

  it('finds the entry for an item id', () => {
    expect(findItem(inventory, 'mana-potion')).toEqual({ item: MANA_POTION, quantity: 1 });
  });

  it('returns null for an item not carried', () => {
    expect(findItem(inventory, 'elixir')).toBeNull();
    expect(findItem(createInventory(), 'health-potion')).toBeNull();
  });
});

describe('removeItem', () => {
  it('uses up one of a stacked item', () => {
    const inventory = createInventory([{ item: HEALTH_POTION, quantity: 3 }]);
    expect(removeItem(inventory, 'health-potion')).toEqual([{ item: HEALTH_POTION, quantity: 2 }]);
  });

  it('drops the entry once the last one is used, keeping the others in order', () => {
    const inventory = createInventory(STARTING_ITEMS);
    expect(removeItem(inventory, 'health-potion')).toEqual([{ item: MANA_POTION, quantity: 1 }]);
  });

  it('does not mutate the inventory it was given', () => {
    const inventory = createInventory(STARTING_ITEMS);
    removeItem(inventory, 'health-potion');
    expect(inventory).toHaveLength(2);
  });

  it('throws for an item not carried', () => {
    expect(() => removeItem(createInventory(), 'health-potion')).toThrow();
  });
});

describe('getItemRecovery', () => {
  it('restores the full amount when there is room', () => {
    expect(getItemRecovery(unitAt({ health: 2 }), HEALTH_POTION)).toBe(HEALTH_POTION.amount);
    expect(getItemRecovery(unitAt({ mana: 0 }), MANA_POTION)).toBe(MANA_POTION.amount);
  });

  it('is capped by how far the stat is below its maximum', () => {
    expect(getItemRecovery(unitAt({ health: 8 }), HEALTH_POTION)).toBe(2);
    expect(getItemRecovery(unitAt({ mana: 4 }), MANA_POTION)).toBe(1);
  });

  it('is 0 when the stat is full', () => {
    expect(getItemRecovery(unitAt(), HEALTH_POTION)).toBe(0);
    expect(getItemRecovery(unitAt(), MANA_POTION)).toBe(0);
  });

  it('only looks at the stat the item restores', () => {
    expect(getItemRecovery(unitAt({ health: 1 }), MANA_POTION)).toBe(0);
    expect(getItemRecovery(unitAt({ mana: 0 }), HEALTH_POTION)).toBe(0);
  });

  it('is 0 for a unit with no mana pool', () => {
    expect(getItemRecovery(unitAt({ mana: 0, maxMana: 0 }), MANA_POTION)).toBe(0);
  });

  it('is 0 for an item restoring an unknown stat', () => {
    expect(getItemRecovery(unitAt({ health: 1 }), { id: 'x', stat: 'luck', amount: 3 })).toBe(0);
  });
});

describe('canUseItem', () => {
  it('is true only when the item would restore something', () => {
    expect(canUseItem(unitAt({ health: 9 }), HEALTH_POTION)).toBe(true);
    expect(canUseItem(unitAt(), HEALTH_POTION)).toBe(false);
  });
});

describe('getItemActions', () => {
  it('lists each item with its quantity, disabling ones that would do nothing', () => {
    const inventory = createInventory([
      { item: HEALTH_POTION, quantity: 2 },
      { item: MANA_POTION, quantity: 1 },
    ]);
    const actions = getItemActions(unitAt({ health: 4 }), inventory);
    expect(actions).toEqual([
      { id: 'health-potion', label: 'Health Potion', quantity: 2, disabled: false },
      { id: 'mana-potion', label: 'Mana Potion', quantity: 1, disabled: true },
    ]);
    expect(Object.isFrozen(actions)).toBe(true);
    expect(actions.every(Object.isFrozen)).toBe(true);
  });

  it('is empty for an empty inventory', () => {
    expect(getItemActions(unitAt(), createInventory())).toEqual([]);
  });
});
