import { describe, expect, it } from 'vitest';
import { createInventory, HEALTH_POTION, MAX_INVENTORY_SLOTS } from './items.ts';
import { getTomeSpell, getUsesToLearn, isTome, knowsSpell, learnSpell, recordTomeUse, type Tome } from './tomes.ts';
import { FIRE, FIRE_SPELL, IRON_SPEAR, NATURAL_WEAPON_IDS, WEAPONS, weaponEntry } from './weapons.ts';

const FIRE_TOME = FIRE as Tome;
const potion = { item: HEALTH_POTION, quantity: 1 };

describe('the Fire tome', () => {
  it('is a tome that teaches Fire after 5 strikes', () => {
    expect(isTome(FIRE)).toBe(true);
    expect(FIRE.teaches).toEqual({ spellId: 'fire-spell', afterUses: 5 });
    expect(getTomeSpell(FIRE_TOME)).toBe(FIRE_SPELL);
  });

  it('teaches a spell with its numbers that never breaks and stays with its learner', () => {
    const { might, hit, crit, weight, minRange, maxRange, type } = FIRE;
    expect(FIRE_SPELL).toMatchObject({ might, hit, crit, weight, minRange, maxRange, type, uses: null });
    expect(isTome(FIRE_SPELL)).toBe(false);
    expect(WEAPONS).toContain(FIRE_SPELL);
    expect(NATURAL_WEAPON_IDS.has(FIRE_SPELL.id)).toBe(true);
    expect(NATURAL_WEAPON_IDS.has(FIRE.id)).toBe(false);
  });
});

describe('isTome', () => {
  it('is false for a weapon that teaches nothing', () => {
    expect(isTome(IRON_SPEAR)).toBe(false);
  });
});

describe('getTomeSpell', () => {
  it('throws when the spell is unknown', () => {
    expect(() => getTomeSpell(FIRE_TOME, [IRON_SPEAR])).toThrow('Unknown spell: fire-spell');
  });
});

describe('knowsSpell', () => {
  it('is true only when the spell is carried', () => {
    expect(knowsSpell(createInventory([weaponEntry(FIRE)]), FIRE_TOME)).toBe(false);
    expect(knowsSpell(createInventory([weaponEntry(FIRE_SPELL)]), FIRE_TOME)).toBe(true);
  });
});

describe('recordTomeUse', () => {
  it('counts strikes until the tome is learned, then forgets it', () => {
    let progress = {};
    for (let strike = 1; strike < 5; strike++) {
      const result = recordTomeUse(progress, FIRE_TOME);
      expect(result).toEqual({ progress: { fire: strike }, learned: false });
      progress = result.progress;
    }
    expect(getUsesToLearn(progress, FIRE_TOME)).toBe(1);
    expect(recordTomeUse(progress, FIRE_TOME)).toEqual({ progress: {}, learned: true });
  });

  it('keeps progress on other tomes and leaves its input alone', () => {
    const progress = Object.freeze({ other: 2, fire: 4 });
    const result = recordTomeUse(progress, FIRE_TOME);
    expect(result).toEqual({ progress: { other: 2 }, learned: true });
    expect(progress).toEqual({ other: 2, fire: 4 });
    expect(Object.isFrozen(result.progress)).toBe(true);
  });

  it('learns on the first strike from a tome that teaches after one', () => {
    const quick = { ...FIRE_TOME, teaches: { spellId: 'fire-spell', afterUses: 1 } };
    expect(recordTomeUse({}, quick).learned).toBe(true);
  });
});

describe('getUsesToLearn', () => {
  it('is the full count with no progress, never below zero', () => {
    expect(getUsesToLearn({}, FIRE_TOME)).toBe(5);
    expect(getUsesToLearn({ fire: 9 }, FIRE_TOME)).toBe(0);
  });
});

describe('learnSpell', () => {
  it("puts the spell in the tome's slot and moves the tome to the end", () => {
    const tome = { item: FIRE, quantity: 25 };
    const { inventory, leftover } = learnSpell(createInventory([tome, potion]), 0, FIRE_SPELL);
    expect(inventory).toEqual([weaponEntry(FIRE_SPELL), potion, tome]);
    expect(leftover).toBeNull();
    expect(Object.isFrozen(inventory)).toBe(true);
  });

  it('hands the tome back when there is no room to keep it', () => {
    const tome = { item: FIRE, quantity: 25 };
    const fillers = Array.from({ length: MAX_INVENTORY_SLOTS - 1 }, () => weaponEntry(IRON_SPEAR));
    const { inventory, leftover } = learnSpell(
      createInventory([...fillers, tome]),
      MAX_INVENTORY_SLOTS - 1,
      FIRE_SPELL,
    );
    expect(inventory).toEqual([...fillers, weaponEntry(FIRE_SPELL)]);
    expect(leftover).toEqual(tome);
  });

  it('adds the spell at the end when the tome broke teaching it', () => {
    const { inventory, leftover } = learnSpell(createInventory([potion]), null, FIRE_SPELL);
    expect(inventory).toEqual([potion, weaponEntry(FIRE_SPELL)]);
    expect(leftover).toBeNull();
  });

  it('throws when there is no tome at the slot', () => {
    expect(() => learnSpell(createInventory([potion]), 3, FIRE_SPELL)).toThrow('No tome at slot 3');
  });
});
