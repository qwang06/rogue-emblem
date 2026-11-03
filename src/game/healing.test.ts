import { describe, expect, it } from 'vitest';
import { createGrid, setUnit } from './grid.ts';
import {
  findUsableStaff,
  getHealAmount,
  getHealTargets,
  HEAL_STAFF,
  isStaff,
  isWounded,
  staffEntry,
  type Staff,
} from './healing.ts';
import { HEALTH_POTION } from './items.ts';
import { IRON_SPEAR } from './weapons.ts';

const LONG_STAFF: Staff = Object.freeze({ ...HEAL_STAFF, id: 'long-staff', minRange: 1, maxRange: 3 });

describe('HEAL_STAFF', () => {
  it('heals an adjacent ally for 2 plus intelligence', () => {
    expect(HEAL_STAFF).toMatchObject({ kind: 'staff', hands: 2, power: 2, minRange: 1, maxRange: 1 });
    expect(Object.isFrozen(HEAL_STAFF)).toBe(true);
  });

  it('is a staff, unlike weapons and potions', () => {
    expect(isStaff(HEAL_STAFF)).toBe(true);
    expect(isStaff(IRON_SPEAR)).toBe(false);
    expect(isStaff(HEALTH_POTION)).toBe(false);
  });

  it('makes an inventory entry of one', () => {
    expect(staffEntry(HEAL_STAFF)).toEqual({ item: HEAL_STAFF, quantity: 1 });
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
  it("restores the staff's power plus the healer's intelligence", () => {
    expect(getHealAmount({ intelligence: 3 }, HEAL_STAFF, { health: 1, maxHealth: 10 })).toBe(5);
  });

  it('is capped at the missing health', () => {
    expect(getHealAmount({ intelligence: 3 }, HEAL_STAFF, { health: 8, maxHealth: 10 })).toBe(2);
  });

  it('restores nothing at full health', () => {
    expect(getHealAmount({ intelligence: 3 }, HEAL_STAFF, { health: 10, maxHealth: 10 })).toBe(0);
  });

  it('still heals with no intelligence', () => {
    expect(getHealAmount({ intelligence: 0 }, HEAL_STAFF, { health: 1, maxHealth: 10 })).toBe(2);
  });
});

describe('findUsableStaff', () => {
  const staves = [
    { staff: HEAL_STAFF, index: 0 },
    { staff: LONG_STAFF, index: 1 },
  ];

  it('picks the first staff with someone to heal', () => {
    expect(findUsableStaff(staves, () => true)).toEqual({ staff: HEAL_STAFF, index: 0 });
    expect(findUsableStaff(staves, (staff) => staff === LONG_STAFF)?.index).toBe(1);
  });

  it('is null when no staff reaches anyone', () => {
    expect(findUsableStaff(staves, () => false)).toBeNull();
    expect(findUsableStaff([], () => true)).toBeNull();
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
