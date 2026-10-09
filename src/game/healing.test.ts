import { describe, expect, it } from 'vitest';
import { createGrid, setUnit } from './grid.ts';
import {
  findUsableStaff,
  getHealAmount,
  getHealTargets,
  getStaves,
  HEAL_STAFF,
  isStaff,
  isWounded,
  spendStaffUse,
  staffEntry,
  type Staff,
} from './healing.ts';
import { HEALTH_POTION, STARTING_ITEMS } from './items.ts';
import { IRON_SPEAR, weaponEntry } from './weapons.ts';

const LONG_STAFF: Staff = Object.freeze({ ...HEAL_STAFF, id: 'long-staff', minRange: 1, maxRange: 3 });

describe('HEAL_STAFF', () => {
  it('heals an adjacent ally for 2 plus magic, 20 times', () => {
    expect(HEAL_STAFF).toMatchObject({ kind: 'staff', power: 2, minRange: 1, maxRange: 1, uses: 20 });
    expect(Object.isFrozen(HEAL_STAFF)).toBe(true);
  });

  it('is a staff, unlike weapons and potions', () => {
    expect(isStaff(HEAL_STAFF)).toBe(true);
    expect(isStaff(IRON_SPEAR)).toBe(false);
    expect(isStaff(HEALTH_POTION)).toBe(false);
  });

  it('starts an inventory entry with all its uses', () => {
    expect(staffEntry(HEAL_STAFF)).toEqual({ item: HEAL_STAFF, quantity: 20 });
  });
});

describe('isWounded', () => {
  it('is true below maximum health', () => {
    expect(isWounded({ health: 9, maxHealth: 10 })).toBe(true);
  });

  it('is false at full health', () => {
    expect(isWounded({ health: 10, maxHealth: 10 })).toBe(false);
  });

  it('is false for the dead', () => {
    expect(isWounded({ health: 0, maxHealth: 10 })).toBe(false);
  });
});

describe('getHealAmount', () => {
  it("restores the staff's power plus the healer's magic", () => {
    expect(getHealAmount({ magic: 3 }, HEAL_STAFF, { health: 1, maxHealth: 10 })).toBe(5);
  });

  it('is capped at the missing health', () => {
    expect(getHealAmount({ magic: 3 }, HEAL_STAFF, { health: 8, maxHealth: 10 })).toBe(2);
  });

  it('restores nothing at full health', () => {
    expect(getHealAmount({ magic: 3 }, HEAL_STAFF, { health: 10, maxHealth: 10 })).toBe(0);
  });

  it('still heals with no magic', () => {
    expect(getHealAmount({ magic: 0 }, HEAL_STAFF, { health: 1, maxHealth: 10 })).toBe(2);
  });
});

describe('getStaves', () => {
  it('lists the staves with their slots and uses left, skipping everything else', () => {
    const inventory = [weaponEntry(IRON_SPEAR), { item: HEAL_STAFF, quantity: 7 }, ...STARTING_ITEMS];
    expect(getStaves(inventory)).toEqual([{ staff: HEAL_STAFF, index: 1, uses: 7 }]);
  });

  it('is empty without a staff', () => {
    expect(getStaves(STARTING_ITEMS)).toEqual([]);
  });
});

describe('findUsableStaff', () => {
  const inventory = [staffEntry(HEAL_STAFF), staffEntry(LONG_STAFF)];

  it('picks the first staff with someone to heal', () => {
    expect(findUsableStaff(inventory, () => true)).toEqual({ staff: HEAL_STAFF, index: 0, uses: 20 });
    expect(findUsableStaff(inventory, (staff) => staff === LONG_STAFF)?.index).toBe(1);
  });

  it('is null when no staff reaches anyone', () => {
    expect(findUsableStaff(inventory, () => false)).toBeNull();
    expect(findUsableStaff(STARTING_ITEMS, () => true)).toBeNull();
  });
});

describe('getHealTargets', () => {
  // h = healer at (2, 2); a = ally next to it, b = ally two tiles away,
  // e = enemy next to it.
  let grid = createGrid(5, 5);
  grid = setUnit(grid, 2, 2, 'h');
  grid = setUnit(grid, 3, 2, 'a');
  grid = setUnit(grid, 2, 4, 'b');
  grid = setUnit(grid, 1, 2, 'e');
  const isWoundedAlly = (unitId: string) => unitId === 'a' || unitId === 'b';

  it('finds the wounded allies the staff reaches', () => {
    expect(getHealTargets(grid, { x: 2, y: 2 }, HEAL_STAFF, isWoundedAlly)).toEqual([{ x: 3, y: 2, unitId: 'a' }]);
  });

  it('reaches further with a longer staff', () => {
    const targets = getHealTargets(grid, { x: 2, y: 2 }, LONG_STAFF, isWoundedAlly);
    expect(targets.map((t) => t.unitId).sort()).toEqual(['a', 'b']);
  });

  it("never offers the healer's own tile", () => {
    expect(getHealTargets(grid, { x: 2, y: 2 }, LONG_STAFF, () => true).some((t) => t.unitId === 'h')).toBe(false);
  });

  it('is empty at the map edge with no one around', () => {
    expect(getHealTargets(createGrid(3, 3), { x: 0, y: 0 }, HEAL_STAFF, () => true)).toEqual([]);
  });
});

describe('spendStaffUse', () => {
  it('spends one use and leaves the rest of the inventory alone', () => {
    const inventory = [weaponEntry(IRON_SPEAR), staffEntry(HEAL_STAFF)];
    const { inventory: next, broke } = spendStaffUse(inventory, 1);
    expect(broke).toBe(false);
    expect(next[1]).toEqual({ item: HEAL_STAFF, quantity: 19 });
    expect(next[0]).toBe(inventory[0]);
    expect(Object.isFrozen(next)).toBe(true);
  });

  it('breaks the staff on its last use', () => {
    const { inventory, broke } = spendStaffUse([{ item: HEAL_STAFF, quantity: 1 }, ...STARTING_ITEMS], 0);
    expect(broke).toBe(true);
    expect(inventory).toEqual(STARTING_ITEMS);
  });

  it('throws when there is no staff in the slot', () => {
    expect(() => spendStaffUse([weaponEntry(IRON_SPEAR)], 0)).toThrow('No staff at slot 0');
    expect(() => spendStaffUse([], 3)).toThrow();
  });
});
