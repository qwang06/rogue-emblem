import { describe, expect, it } from 'vitest';
import { getTomeSpell, isTome, knowsSpell, recordTomeUse, type Tome } from './tomes.ts';
import { FIRE, FIRE_SPELL, IRON_SPEAR, NATURAL_WEAPON_IDS, WEAPONS } from './weapons.ts';

const FIRE_TOME = FIRE as Tome;

describe('the Fire tome', () => {
  it('is a tome that teaches Fire after 5 strikes', () => {
    expect(isTome(FIRE)).toBe(true);
    expect(FIRE.teaches).toEqual({ spellId: 'fire-spell', afterUses: 5 });
    expect(getTomeSpell(FIRE_TOME)).toBe(FIRE_SPELL);
  });

  it('teaches a spell with its numbers that stays with its learner', () => {
    const { power, hit, crit, weight, minRange, maxRange, type } = FIRE;
    expect(FIRE_SPELL).toMatchObject({ power, hit, crit, weight, minRange, maxRange, type });
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
  it('is true only when the spell is among the innate attacks', () => {
    expect(knowsSpell([IRON_SPEAR], FIRE_TOME)).toBe(false);
    expect(knowsSpell([FIRE_SPELL], FIRE_TOME)).toBe(true);
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
    expect(progress).toEqual({ fire: 4 });
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
